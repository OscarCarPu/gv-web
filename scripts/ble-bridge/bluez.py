#!/usr/bin/env python3
"""BlueZ transport for the bulb bridge, over D-Bus via Gio.

Why Gio and not bleak/python-dbus
---------------------------------
* ``bleak`` is not installed and would be a pip dependency on every bridge host.
* ``python-dbus`` is broken on this machine (``dbus.SystemBus`` is missing).
* PyGObject ships with the distro and works, so the bridge needs no pip installs.

The decisive reason is notifications. BlueZ tears down a ``StartNotify`` subscription the
moment the D-Bus client that asked for it drops off the bus, so one-shot tools
(``gdbus``, ``bluetoothctl -- <cmd>``) report success while ``Notifying`` stays ``false``
and nothing is ever delivered. A long-lived process with a running ``GLib.MainLoop`` is
the only thing that gets readback out of these bulbs — which is exactly what a daemon is.

Threading
---------
``GDBusConnection`` is thread-safe and ``call_sync`` blocks only its caller, so HTTP
handler threads talk to BlueZ directly. Signals are dispatched on whichever thread
iterates the default main context, so :func:`run_mainloop` claims one thread for that and
notification callbacks land there. A per-device lock keeps two commands from interleaving
on one bulb — BLE tolerates that badly.
"""

from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from gi.repository import Gio, GLib

BLUEZ = "org.bluez"
ADAPTER_IFACE = "org.bluez.Adapter1"
DEVICE_IFACE = "org.bluez.Device1"
CHAR_IFACE = "org.bluez.GattCharacteristic1"
PROPS_IFACE = "org.freedesktop.DBus.Properties"
OBJECT_MANAGER = "org.freedesktop.DBus.ObjectManager"

DEFAULT_ADAPTER = "hci0"
CALL_TIMEOUT_MS = 25000


class BluezError(RuntimeError):
    pass


_bus: Optional[Gio.DBusConnection] = None
_bus_lock = threading.Lock()


def bus() -> Gio.DBusConnection:
    global _bus
    with _bus_lock:
        if _bus is None:
            _bus = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        return _bus


def call(path: str, iface: str, method: str, params=None, timeout_ms: int = CALL_TIMEOUT_MS):
    return bus().call_sync(
        BLUEZ, path, iface, method, params, None, Gio.DBusCallFlags.NONE, timeout_ms, None
    )


def get_prop(path: str, iface: str, name: str):
    result = call(path, PROPS_IFACE, "Get", GLib.Variant("(ss)", (iface, name)))
    return result.unpack()[0]


def managed_objects() -> dict:
    result = bus().call_sync(
        BLUEZ, "/", OBJECT_MANAGER, "GetManagedObjects", None, None,
        Gio.DBusCallFlags.NONE, CALL_TIMEOUT_MS, None,
    )
    return result.unpack()[0]


def device_path(address: str, adapter: str = DEFAULT_ADAPTER) -> str:
    return f"/org/bluez/{adapter}/dev_{address.upper().replace(':', '_')}"


# ---------------------------------------------------------------------------
# Main loop (owns signal dispatch)
# ---------------------------------------------------------------------------

_loop: Optional[GLib.MainLoop] = None


def run_mainloop() -> None:
    """Block forever dispatching D-Bus signals. Call on a dedicated daemon thread."""
    global _loop
    loop = GLib.MainLoop()
    _loop = loop
    loop.run()


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------


def _discover_briefly(adapter: str, seconds: float) -> None:
    """Nudge BlueZ into noticing a bulb it has no object for yet."""
    adapter_path = f"/org/bluez/{adapter}"
    try:
        call(adapter_path, ADAPTER_IFACE, "StartDiscovery")
    except GLib.Error:
        return  # already discovering, or no adapter — the caller's connect will report it
    try:
        time.sleep(seconds)
    finally:
        try:
            call(adapter_path, ADAPTER_IFACE, "StopDiscovery")
        except GLib.Error:
            pass


def is_connected(address: str, adapter: str = DEFAULT_ADAPTER) -> bool:
    try:
        return bool(get_prop(device_path(address, adapter), DEVICE_IFACE, "Connected"))
    except GLib.Error:
        return False


def connect(address: str, adapter: str = DEFAULT_ADAPTER, attempts: int = 3) -> str:
    """Connect and wait for the GATT table. Returns the device's D-Bus path.

    Retries because the first attempt on these bulbs routinely dies with
    ``le-connection-abort-by-local`` partway through service discovery; the next one
    almost always succeeds. If it never does, the usual cause is another central already
    holding the bulb — the vendor app on a phone will do this, and while it is connected
    the bulb stops advertising entirely.
    """
    path = device_path(address, adapter)
    last: Optional[str] = None

    for _attempt in range(attempts):
        try:
            if not bool(get_prop(path, DEVICE_IFACE, "Connected")):
                call(path, DEVICE_IFACE, "Connect")
            if _wait_for_services(path):
                return path
            last = "services never resolved"
        except GLib.Error as e:
            last = e.message or str(e)
            if "UnknownObject" in last or "Does Not Exist" in last:
                # BlueZ has no object for this address. Expected, not exceptional: these
                # bulbs are never bonded, and BlueZ drops an unbonded device's object
                # some time after it disconnects. A scan makes it reappear — so retry
                # discovery on every attempt, not just the first.
                _discover_briefly(adapter, 8.0)
                continue
        time.sleep(0.8)

    raise BluezError(last or "connect failed")


def _wait_for_services(path: str, timeout: float = 15.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if bool(get_prop(path, DEVICE_IFACE, "ServicesResolved")):
                return True
        except GLib.Error:
            return False
        time.sleep(0.25)
    return False


def disconnect(address: str, adapter: str = DEFAULT_ADAPTER) -> None:
    try:
        call(device_path(address, adapter), DEVICE_IFACE, "Disconnect")
    except GLib.Error:
        pass


# ---------------------------------------------------------------------------
# Characteristics
# ---------------------------------------------------------------------------


def find_characteristic(address: str, uuid: str, adapter: str = DEFAULT_ADAPTER) -> str:
    """Resolve a characteristic's object path by UUID.

    Deliberately not hardcoded: BlueZ's ``serviceXXXX/charXXXX`` numbering is a cache
    artefact, stable most of the time and silently different after a re-pair or an
    adapter reset. Looking it up by UUID costs one ``GetManagedObjects`` and never rots.
    """
    prefix = device_path(address, adapter) + "/"
    want = uuid.lower()

    for path, interfaces in managed_objects().items():
        if not path.startswith(prefix):
            continue
        char = interfaces.get(CHAR_IFACE)
        if char and str(char.get("UUID", "")).lower() == want:
            return path

    raise BluezError(f"characteristic {uuid} not found on {address}")


def write(path: str, payload: bytes, write_type: Optional[str] = None) -> None:
    """Write a characteristic. ``write_type`` is left to BlueZ unless forced.

    Do not default this to ``"command"`` (write-without-response): the Lexman's ``a101``
    advertises plain ``write`` only, and naming a type the characteristic does not
    support makes BlueZ reject the call outright. Letting BlueZ pick works for both.
    """
    options = {} if write_type is None else {"type": GLib.Variant("s", write_type)}
    call(path, CHAR_IFACE, "WriteValue", GLib.Variant("(aya{sv})", (list(payload), options)))


class Notifications:
    """Latest notification bytes per characteristic path, with a wait primitive.

    Signal callbacks arrive on the main-loop thread; readers are HTTP threads. The event
    is re-armed before each write so a stale notification cannot satisfy a later query.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._values: dict[str, bytes] = {}
        self._events: dict[str, threading.Event] = {}
        self._subscriptions: dict[str, int] = {}

    def subscribe(self, path: str) -> None:
        with self._lock:
            if path in self._subscriptions:
                return

        try:
            notifying = bool(get_prop(path, CHAR_IFACE, "Notifying"))
        except GLib.Error:
            notifying = False
        if not notifying:
            call(path, CHAR_IFACE, "StartNotify")

        subscription = bus().signal_subscribe(
            BLUEZ, PROPS_IFACE, "PropertiesChanged", path, None,
            Gio.DBusSignalFlags.NONE, self._on_signal, path,
        )
        with self._lock:
            self._subscriptions[path] = subscription

    def forget(self, path: str) -> None:
        with self._lock:
            subscription = self._subscriptions.pop(path, None)
            self._values.pop(path, None)
            self._events.pop(path, None)
        if subscription is not None:
            bus().signal_unsubscribe(subscription)

    def forget_all_for(self, address: str, adapter: str = DEFAULT_ADAPTER) -> None:
        prefix = device_path(address, adapter) + "/"
        with self._lock:
            paths = [p for p in self._subscriptions if p.startswith(prefix)]
        for path in paths:
            self.forget(path)

    def _on_signal(self, _conn, _sender, _path, _iface, _signal, params, path) -> None:
        interface, changed, _invalidated = params.unpack()
        if interface != CHAR_IFACE or "Value" not in changed:
            return
        with self._lock:
            self._values[path] = bytes(changed["Value"])
            event = self._events.get(path)
        if event:
            event.set()

    def arm(self, path: str) -> threading.Event:
        with self._lock:
            event = self._events.get(path)
            if event is None:
                event = threading.Event()
                self._events[path] = event
            event.clear()
            return event

    def wait(self, path: str, event: threading.Event, timeout: float) -> Optional[bytes]:
        if not event.wait(timeout):
            return None
        with self._lock:
            return self._values.get(path)


# ---------------------------------------------------------------------------
# Discovery helpers (CLI)
# ---------------------------------------------------------------------------


def scan(seconds: float = 8.0, adapter: str = DEFAULT_ADAPTER) -> list[dict]:
    adapter_path = f"/org/bluez/{adapter}"
    try:
        call(adapter_path, ADAPTER_IFACE, "StartDiscovery")
    except GLib.Error as e:
        raise BluezError(e.message) from e
    try:
        time.sleep(seconds)
    finally:
        try:
            call(adapter_path, ADAPTER_IFACE, "StopDiscovery")
        except GLib.Error:
            pass

    devices = []
    for path, interfaces in managed_objects().items():
        device = interfaces.get(DEVICE_IFACE)
        if not device or not path.startswith(f"/org/bluez/{adapter}/dev_"):
            continue
        devices.append(
            {
                "address": str(device.get("Address", "")),
                "name": str(device.get("Name", "") or device.get("Alias", "")),
                "rssi": int(device.get("RSSI", -999)),
            }
        )
    devices.sort(key=lambda d: d["rssi"], reverse=True)
    return devices


def inspect(address: str, adapter: str = DEFAULT_ADAPTER) -> dict:
    """Dump the GATT table — the raw material for writing a new Protocol."""
    path = connect(address, adapter)
    prefix = path + "/"
    services: dict[str, dict] = {}

    for object_path, interfaces in sorted(managed_objects().items()):
        if not object_path.startswith(prefix):
            continue

        service = interfaces.get("org.bluez.GattService1")
        if service:
            services.setdefault(
                object_path,
                {"path": object_path, "uuid": str(service.get("UUID", "")), "characteristics": []},
            )
            continue

        char = interfaces.get(CHAR_IFACE)
        if char:
            owner = str(char.get("Service", ""))
            entry = services.setdefault(owner, {"path": owner, "uuid": "?", "characteristics": []})
            entry["characteristics"].append(
                {
                    "path": object_path,
                    "uuid": str(char.get("UUID", "")),
                    "flags": [str(f) for f in char.get("Flags", [])],
                }
            )

    return {"address": address, "services": list(services.values())}


def register_signal_callback(path: str, callback: Callable) -> int:
    return bus().signal_subscribe(
        BLUEZ, PROPS_IFACE, "PropertiesChanged", path, None, Gio.DBusSignalFlags.NONE, callback, None
    )
