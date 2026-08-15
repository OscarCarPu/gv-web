#!/usr/bin/env python3
"""BLE bridge for the Domotics → Lights section.

Why this exists
---------------
gv-api runs in Docker on a server with **no Bluetooth radio at all** — no adapter, no
bluez, no ``/sys/class/bluetooth``. Even with a dongle plugged in, speaking BLE from that
container would mean handing it the host's DBus and network namespace. So the radio work
lives here instead: a small daemon on any LAN machine that does have Bluetooth (a laptop,
a Pi), and gv-api talks to it over HTTP.

    gv-api  ──HTTP──▶  bridge.py  ──D-Bus/BlueZ──▶  bulb

(This file lives in the gv-web repo only because it is a deployment artefact of it; the
lights themselves are a gv-api domain — see ``gv-api/docs/api/lights.md``.)

It also has to be a *daemon* rather than a one-shot command: BlueZ cancels a
``StartNotify`` subscription as soon as the client that requested it leaves the bus, so
nothing short of a long-lived process with a main loop can read these bulbs back.
See ``bluez.py`` for the details.

Running it
----------
    python scripts/ble-bridge/bridge.py --token "$LIGHTS_BRIDGE_TOKEN"
    python scripts/ble-bridge/bridge.py --mock      # no radio; accept and remember everything

Then in gv-api's .env:

    LIGHTS_DRIVER=bridge
    LIGHTS_BRIDGE_URL=http://<this-machine>:8477
    LIGHTS_BRIDGE_TOKEN=<same token>

Discovering a new bulb
----------------------
    python scripts/ble-bridge/bridge.py --scan
    python scripts/ble-bridge/bridge.py --inspect AA:BB:CC:DD:EE:FF

Feed that output into a new ``Protocol`` subclass in ``protocols.py``.

HTTP API
--------
    GET  /health                     -> {"ok", "backend", "protocols", "devices"}
    POST /state    {device}          -> LightState
    POST /command  {device, command} -> LightState
    GET  /scan?seconds=8             -> {"devices": [{address, name, rssi}]}
    GET  /inspect?address=..         -> {"services": [...]}

``device`` is ``{"id", "address", "protocol", "options"}`` and ``command`` is one of
``{"type":"power","on":bool}``, ``{"type":"brightness","value":0-100}``,
``{"type":"color","color":{"r","g","b"}}``, ``{"type":"colorTemp","kelvin":int}`` —
the same shapes ``gv-api/internal/lights/dto.go`` declares.

Dependencies: the standard library plus PyGObject, which ships with the distro. No pip.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DEFAULT_PORT = 8477
#: Disconnect a bulb nobody has touched for this long. Reconnecting costs a second or
#: two, but holding the link forever locks out its own remote and the vendor app — these
#: bulbs accept exactly one central at a time.
IDLE_DISCONNECT_S = 90.0

ARGS: argparse.Namespace

# Imported lazily in main() so --mock runs on a machine with no PyGObject.
bluez = None
REGISTRY: dict = {}
get_protocol = None


# ---------------------------------------------------------------------------
# State cache
# ---------------------------------------------------------------------------
# Even a readable bulb is only read on demand, and some are not readable at all, so the
# bridge keeps its own record of what it last asked for. Every reply is this cache
# merged with whatever the bulb actually confirmed.

DEFAULT_STATE = {
    "power": False,
    "brightness": 60,
    "mode": "white",
    "color": {"r": 255, "g": 255, "b": 255},
    "colorTemp": 2700,
}

_states: dict[str, dict] = {}
_states_lock = threading.RLock()


def cached_state(device_id: str) -> dict:
    with _states_lock:
        return dict(_states.get(device_id) or DEFAULT_STATE)


def update_state(device_id: str, changes: dict) -> dict:
    with _states_lock:
        state = _states.get(device_id)
        if state is None:
            state = dict(DEFAULT_STATE)
            _states[device_id] = state
        state.update(changes)
        return dict(state)


# ---------------------------------------------------------------------------
# Per-bulb serialisation
# ---------------------------------------------------------------------------
# BLE stacks serialise badly: two overlapping GATT writes to one peripheral tend to fail
# both. The clients already throttle to one write in flight per control, and this makes it
# structural.

_device_locks: dict[str, threading.Lock] = {}
_device_locks_guard = threading.Lock()
_last_used: dict[str, float] = {}


def device_lock(address: str) -> threading.Lock:
    with _device_locks_guard:
        return _device_locks.setdefault(address, threading.Lock())


def reap_idle_connections() -> None:
    """Release bulbs nobody has used lately so their remotes and the vendor app work again."""
    while True:
        time.sleep(15)
        now = time.monotonic()
        for address, used in list(_last_used.items()):
            if now - used <= IDLE_DISCONNECT_S:
                continue
            lock = device_lock(address)
            if not lock.acquire(blocking=False):
                continue  # in use right now; try again next sweep
            try:
                _last_used.pop(address, None)
                for protocol in REGISTRY.values():
                    protocol.release({"address": address, "options": {}})
                bluez.disconnect(address)
                if ARGS.verbose:
                    print(f"idle disconnect: {address}")
            except Exception:
                if ARGS.verbose:
                    traceback.print_exc()
            finally:
                lock.release()


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def _apply_to_cache(command: dict) -> dict:
    """What a command means for our record of the bulb.

    Records *only* what the command actually changed. It deliberately does not infer that
    setting brightness or colour turns the bulb on: on the LEXMAN those are separate frames,
    and a dimmed-but-off bulb stays off. Inferring it made the UI report "on" while the room
    stayed dark — and, worse, made "All on" a no-op, because the bulb already looked on.
    """
    kind = command.get("type")
    if kind == "power":
        return {"power": bool(command.get("on"))}
    if kind == "brightness":
        return {"brightness": max(0, min(100, int(command.get("value", 0))))}
    if kind == "color":
        color = command.get("color") or {}
        return {
            "color": {
                "r": max(0, min(255, int(color.get("r", 0)))),
                "g": max(0, min(255, int(color.get("g", 0)))),
                "b": max(0, min(255, int(color.get("b", 0)))),
            },
            "mode": "color",
        }
    if kind == "colorTemp":
        return {"mode": "white", "colorTemp": int(command.get("kelvin", 2700))}
    return {}


def _dispatch(protocol, device: dict, command: dict) -> None:
    kind = command.get("type")
    if kind == "power":
        protocol.set_power(device, bool(command.get("on")))
    elif kind == "brightness":
        protocol.set_brightness(device, int(command.get("value", 0)))
    elif kind == "color":
        color = command.get("color") or {}
        protocol.set_color(
            device, int(color.get("r", 0)), int(color.get("g", 0)), int(color.get("b", 0))
        )
    elif kind == "colorTemp":
        protocol.set_color_temp(device, int(command.get("kelvin", 2700)))
    else:
        raise ValueError(f"unknown command type: {kind!r}")


def run_command(device: dict, command: Optional[dict]) -> dict:
    """Read (``command=None``) or write one bulb. Never raises — errors ride in the reply."""
    device_id = device.get("id") or device.get("address") or "unknown"
    address = device.get("address") or ""
    name = "mock" if ARGS.mock else (device.get("protocol") or "generic")

    protocol = get_protocol(name)
    if protocol is None:
        return {
            **cached_state(device_id),
            "online": False,
            "error": f'no protocol "{name}" — add it to scripts/ble-bridge/protocols.py',
        }

    # --mock never touches the radio, so nothing here can fail.
    if ARGS.mock:
        state = update_state(device_id, _apply_to_cache(command)) if command else cached_state(device_id)
        return {**state, "online": True}

    if not address:
        return {**cached_state(device_id), "online": False, "error": "device has no address"}

    with device_lock(address):
        try:
            bluez.connect(address)
            _last_used[address] = time.monotonic()

            if command is None:
                readback = protocol.read(device) if protocol.readable else None
                state = update_state(device_id, readback) if readback else cached_state(device_id)
                return {**state, "online": True}

            _dispatch(protocol, device, command)
            return {**update_state(device_id, _apply_to_cache(command)), "online": True}

        except NotImplementedError as e:
            # A capability this model does not have, or a stub not filled in yet — the
            # bulb is fine, so do not report it offline.
            return {**cached_state(device_id), "online": True, "error": str(e)}
        except Exception as e:
            # Drop the link so the next call reconnects; a half-dead one never recovers.
            try:
                protocol.release(device)
                bluez.disconnect(address)
            except Exception:
                pass
            _last_used.pop(address, None)
            if ARGS.verbose:
                traceback.print_exc()
            message = str(e) or type(e).__name__
            return {**cached_state(device_id), "online": False, "error": message}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------


class Handler(BaseHTTPRequestHandler):
    server_version = "gv-ble-bridge/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A002 (base class name)
        if ARGS.verbose:
            super().log_message(format, *args)

    # -- helpers --

    def _send(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not ARGS.token:
            return True
        return self.headers.get("Authorization", "") == f"Bearer {ARGS.token}"

    def _body(self) -> Optional[dict]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return None
        try:
            parsed = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    # -- routes --

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/health":
            self._send(
                {
                    "ok": True,
                    "backend": "mock" if ARGS.mock else "bluez",
                    "protocols": sorted(REGISTRY),
                    "devices": len(_states),
                }
            )
            return

        if not self._authorized():
            self._send({"error": "unauthorized"}, 401)
            return

        try:
            if parsed.path == "/scan":
                seconds = float(query.get("seconds", ["8"])[0])
                self._send({"devices": bluez.scan(seconds)})
                return

            if parsed.path == "/inspect":
                address = query.get("address", [""])[0]
                if not address:
                    self._send({"error": "address is required"}, 400)
                    return
                with device_lock(address):
                    self._send(bluez.inspect(address))
                return
        except Exception as e:
            if ARGS.verbose:
                traceback.print_exc()
            self._send({"error": f"{type(e).__name__}: {e}"}, 500)
            return

        self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if not self._authorized():
            self._send({"error": "unauthorized"}, 401)
            return

        if parsed.path not in ("/state", "/command"):
            self._send({"error": "not found"}, 404)
            return

        body = self._body()
        if body is None:
            self._send({"error": "body must be a JSON object"}, 400)
            return

        device = body.get("device")
        if not isinstance(device, dict):
            self._send({"error": '"device" is required'}, 400)
            return

        command = None
        if parsed.path == "/command":
            command = body.get("command")
            if not isinstance(command, dict):
                self._send({"error": '"command" is required'}, 400)
                return

        try:
            self._send(run_command(device, command))
        except Exception as e:
            if ARGS.verbose:
                traceback.print_exc()
            self._send({"error": f"{type(e).__name__}: {e}"}, 500)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _load_ble() -> bool:
    """Import the BlueZ layer. False (with a message) when PyGObject is missing."""
    global bluez, REGISTRY, get_protocol
    try:
        import bluez as _bluez
    except Exception as e:  # ImportError, or gi failing to find the typelib
        print(f"BlueZ backend unavailable ({e}) — run with --mock", file=sys.stderr)
        return False

    import protocols

    bluez = _bluez
    REGISTRY = protocols.REGISTRY
    get_protocol = protocols.get_protocol
    return True


def _load_mock() -> None:
    """Protocol registry without importing the BlueZ layer."""
    global REGISTRY, get_protocol

    class _Mock:
        name = "mock"
        readable = False

        def read(self, device):
            return None

        def release(self, device):
            return None

    REGISTRY = {"mock": _Mock()}
    get_protocol = REGISTRY.get


def main() -> int:
    global ARGS

    parser = argparse.ArgumentParser(description="BLE bridge for the Domotics lights (driven by gv-api)")
    parser.add_argument("--host", default="0.0.0.0", help="bind address (default: all)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("BRIDGE_PORT", DEFAULT_PORT)))
    parser.add_argument(
        "--token",
        default=os.environ.get("LIGHTS_BRIDGE_TOKEN", ""),
        help="shared secret gv-api sends as 'Authorization: Bearer'. Empty = no auth.",
    )
    parser.add_argument("--mock", action="store_true", help="no radio; accept and remember everything")
    parser.add_argument(
        "--scan", nargs="?", const=8.0, type=float, metavar="SECONDS",
        help="scan for BLE devices and exit",
    )
    parser.add_argument("--inspect", metavar="ADDRESS", help="dump a device's GATT table and exit")
    parser.add_argument("-v", "--verbose", action="store_true")
    ARGS = parser.parse_args()

    if ARGS.mock:
        _load_mock()
    elif not _load_ble():
        return 1

    # One-shot discovery modes, no server involved.
    if ARGS.scan is not None:
        print(json.dumps({"devices": bluez.scan(ARGS.scan)}, indent=2))
        return 0
    if ARGS.inspect:
        print(json.dumps(bluez.inspect(ARGS.inspect), indent=2))
        return 0

    if not ARGS.mock:
        # Owns D-Bus signal dispatch, which is what makes notifications arrive at all.
        threading.Thread(target=bluez.run_mainloop, daemon=True).start()
        threading.Thread(target=reap_idle_connections, daemon=True).start()

    if not ARGS.token:
        print("warning: no --token, the bridge accepts any caller on the LAN", file=sys.stderr)

    server = ThreadingHTTPServer((ARGS.host, ARGS.port), Handler)
    backend = "mock" if ARGS.mock else "bluez"
    print(f"ble-bridge listening on http://{ARGS.host}:{ARGS.port} (backend: {backend})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
