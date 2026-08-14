#!/usr/bin/env python3
"""Per-model BLE protocols for the bulb bridge.

A "protocol" is the knowledge of how one family of bulbs encodes commands: which GATT
characteristic to write to, and what bytes mean "on", "60% brightness", "this warm".
Every bulb in gv-web's ``LIGHTS`` registry names one via its ``protocol`` field, and the
bridge dispatches on that name.

Adding a bulb model
-------------------
1. ``python scripts/ble-bridge/bridge.py --scan`` to find its address.
2. ``python scripts/ble-bridge/bridge.py --inspect <address>`` to dump its GATT table.
3. Subclass :class:`Protocol`, encode the payloads, register it in ``REGISTRY``.
"""

from __future__ import annotations

from typing import Optional

import bluez

# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------


class Protocol:
    """How one bulb family speaks.

    ``device`` is the dict gv-web sent: ``{"id", "address", "protocol", "options"}`` —
    ``options`` carries anything model-specific (characteristic UUIDs, keys) straight
    from the ``LIGHTS`` env entry, so a per-bulb quirk needs no code change.

    Implementations must be safe to call from several HTTP threads; the bridge holds a
    per-address lock around every call, so they need no locking of their own.
    """

    name = "abstract"
    #: True when the bulb can be asked for its current settings. False means the bridge
    #: answers reads from its own cache of what it last wrote, which is all it can do.
    readable = False

    def read(self, device: dict) -> Optional[dict]:
        """Return a partial gv-web state dict, or None when the bulb cannot be read."""
        return None

    def set_power(self, device: dict, on: bool) -> None:
        raise NotImplementedError

    def set_brightness(self, device: dict, value: int) -> None:
        """``value`` is 0-100; convert to the bulb's own scale here."""
        raise NotImplementedError

    def set_color(self, device: dict, r: int, g: int, b: int) -> None:
        raise NotImplementedError

    def set_color_temp(self, device: dict, kelvin: int) -> None:
        raise NotImplementedError

    def release(self, device: dict) -> None:
        """Drop any per-connection state. Called when the bridge disconnects a bulb."""
        return None


# ---------------------------------------------------------------------------
# Lexman / Adeo ZBEK-13 "CCT smart bulb"  (LEXMAN, Leroy Merlin's Enki app)
# ---------------------------------------------------------------------------


class LexmanProtocol(Protocol):
    """Adeo/LEXMAN ZBEK-13 tunable-white bulb.

    Frame format from https://github.com/davidsmfreire/lexman-ble — the UUIDs in that
    repo match this bulb exactly. Every frame is written to ``a101`` and answered by a
    notification on ``a102``:

        ping         set —                             query 00:00:20:01:02:00:02
        switch       set 00:00:10:01:03:{0}:00:00      query 00:00:10:02
        brightness   set 00:00:11:01:03:{0}:00:00      query 00:00:11:02
        temperature  set 00:00:12:01:04:{1}:{0}:00:00  query 00:00:12:02

    ``{0}`` is the low byte and ``{1}`` the high byte of the argument.

    Two behaviours worth knowing, both observed on the real bulb:
      * Writing a value it already holds produces no notification at all.
      * Some temperature steps stay silent mid-transition, though a follow-up query
        confirms the value did land.
    So a missing notification is never treated as failure — only the query path cares
    about replies, and it falls back to the cache.

    Despite the ``ZB`` in the model name (it speaks Zigbee too) this is plain BLE with no
    pairing: ``Connect`` is enough. It accepts a single central at a time, so if the Enki
    app is connected on a phone the bulb stops advertising and is invisible here.
    """

    name = "lexman"
    readable = True

    WRITE_UUID = "0000a101-1115-1000-0001-617573746f6d"
    NOTIFY_UUID = "0000a102-1115-1000-0001-617573746f6d"

    #: The bulb's own scale. gv-web speaks 0-100 and converts at the boundary.
    BRIGHTNESS_MAX = 254

    #: Vendor range: 153 mireds = coolest, 454 = warmest. The kelvin labels come from the
    #: vendor's stated 2700K-6500K span, so the mapping is linear in kelvin rather than a
    #: true reciprocal (1e6/454 would be ~2200K). It round-trips exactly, which is what
    #: matters for the slider; if the rendered colour ever disagrees with the number, this
    #: is the one place to change.
    MIRED_COOL, MIRED_WARM = 153, 454
    KELVIN_COOL, KELVIN_WARM = 6500, 2700

    #: How long to wait for a query's notification before falling back to the cache.
    QUERY_TIMEOUT = 1.2

    def __init__(self) -> None:
        self._notifications = bluez.Notifications()

    # -- frame helpers --

    def _write_char(self, device: dict) -> str:
        uuid = device.get("options", {}).get("writeChar") or self.WRITE_UUID
        return bluez.find_characteristic(device["address"], uuid)

    def _notify_char(self, device: dict) -> str:
        uuid = device.get("options", {}).get("notifyChar") or self.NOTIFY_UUID
        return bluez.find_characteristic(device["address"], uuid)

    @staticmethod
    def _frame(*values: int) -> bytes:
        return bytes(values)

    def kelvin_to_mired(self, kelvin: int) -> int:
        span = (self.MIRED_WARM - self.MIRED_COOL) / (self.KELVIN_WARM - self.KELVIN_COOL)
        mired = round((kelvin - self.KELVIN_COOL) * span + self.MIRED_COOL)
        return max(self.MIRED_COOL, min(self.MIRED_WARM, mired))

    def mired_to_kelvin(self, mired: int) -> int:
        span = (self.KELVIN_WARM - self.KELVIN_COOL) / (self.MIRED_WARM - self.MIRED_COOL)
        kelvin = (mired - self.MIRED_COOL) * span + self.KELVIN_COOL
        # Snap to 10K. One mired step is ~13K, so the extra digits are quantisation noise,
        # and without this a 2800K write reads back as 2801K and the slider twitches.
        kelvin = round(kelvin / 10) * 10
        return max(self.KELVIN_WARM, min(self.KELVIN_COOL, int(kelvin)))

    def _send(self, device: dict, payload: bytes) -> None:
        bluez.write(self._write_char(device), payload)

    def _query(self, device: dict, payload: bytes) -> Optional[bytes]:
        """Write a query frame and wait for its notification. None when the bulb stays quiet."""
        notify_path = self._notify_char(device)
        self._notifications.subscribe(notify_path)
        event = self._notifications.arm(notify_path)
        bluez.write(self._write_char(device), payload)
        return self._notifications.wait(notify_path, event, self.QUERY_TIMEOUT)

    # -- commands --

    def set_power(self, device: dict, on: bool) -> None:
        self._send(device, self._frame(0x00, 0x00, 0x10, 0x01, 0x03, 1 if on else 0, 0x00, 0x00))

    def set_brightness(self, device: dict, value: int) -> None:
        raw = round(max(0, min(100, value)) * self.BRIGHTNESS_MAX / 100)
        # 0 would read as "off" rather than "dimmest"; the switch command owns off.
        raw = max(1, raw)
        self._send(device, self._frame(0x00, 0x00, 0x11, 0x01, 0x03, raw, 0x00, 0x00))

    def set_color(self, device: dict, r: int, g: int, b: int) -> None:
        raise NotImplementedError("the ZBEK-13 is tunable white only — it has no RGB")

    def set_color_temp(self, device: dict, kelvin: int) -> None:
        mired = self.kelvin_to_mired(kelvin)
        high, low = (mired >> 8) & 0xFF, mired & 0xFF
        self._send(device, self._frame(0x00, 0x00, 0x12, 0x01, 0x04, high, low, 0x00, 0x00))

    # -- readback --

    def read(self, device: dict) -> Optional[dict]:
        state: dict = {"supportsColor": False, "supportsColorTemp": True, "mode": "white"}

        # switch -> 00:00:10:03:02:{0}:{0}
        reply = self._query(device, self._frame(0x00, 0x00, 0x10, 0x02))
        if reply and len(reply) >= 6:
            state["power"] = bool(reply[5])

        # brightness -> 00:00:11:03:02:{0}:{0}
        reply = self._query(device, self._frame(0x00, 0x00, 0x11, 0x02))
        if reply and len(reply) >= 6:
            state["brightness"] = round(reply[5] * 100 / self.BRIGHTNESS_MAX)

        # temperature -> 00:00:12:03:04:{1}:{0}:{1}:{0}
        reply = self._query(device, self._frame(0x00, 0x00, 0x12, 0x02))
        if reply and len(reply) >= 7:
            state["colorTemp"] = self.mired_to_kelvin((reply[5] << 8) | reply[6])

        # Nothing answered at all — report no readback rather than a half-empty state.
        return state if len(state) > 3 else None

    def release(self, device: dict) -> None:
        self._notifications.forget_all_for(device["address"])


# ---------------------------------------------------------------------------
# Template — copy this for the next model
# ---------------------------------------------------------------------------


class TemplateProtocol(Protocol):
    """Skeleton for a write-one-characteristic bulb, the shape most of them take.

    Fill in the payload builders once ``--inspect`` has named the characteristics. The
    one you want is almost always the single ``write`` / ``write-without-response``
    handle on a vendor service — a 128-bit UUID that is *not* of the standard
    ``0000xxxx-0000-1000-8000-00805f9b34fb`` form.

    Payloads usually fall into one of three families:
      * ``[header, opcode, args..., checksum]`` — plain, most common, and what the
        Lexman above turned out to be
      * the same but AES-ECB encrypted with a per-vendor key (Zengge/Triones and kin)
      * a length-prefixed frame with a rolling counter (Telink mesh)
    """

    name = "template"
    readable = False

    WRITE_UUID = "0000ffff-0000-1000-8000-00805f9b34fb"

    def _send(self, device: dict, payload: bytes) -> None:
        uuid = device.get("options", {}).get("writeChar") or self.WRITE_UUID
        bluez.write(bluez.find_characteristic(device["address"], uuid), payload)

    def set_power(self, device: dict, on: bool) -> None:
        raise NotImplementedError("TemplateProtocol: fill in the power payload")

    def set_brightness(self, device: dict, value: int) -> None:
        raise NotImplementedError("TemplateProtocol: fill in the brightness payload")

    def set_color(self, device: dict, r: int, g: int, b: int) -> None:
        raise NotImplementedError("TemplateProtocol: fill in the colour payload")

    def set_color_temp(self, device: dict, kelvin: int) -> None:
        raise NotImplementedError("TemplateProtocol: fill in the CCT payload")


# ---------------------------------------------------------------------------
# Mock — no radio involved
# ---------------------------------------------------------------------------


class MockProtocol(Protocol):
    """Accepts everything and remembers nothing; the bridge's cache does the remembering.

    Lets the whole path (gv-web → HTTP → bridge → protocol) be exercised on a machine
    with no Bluetooth adapter — which is what the server this app runs on actually is.
    """

    name = "mock"
    readable = False

    def set_power(self, device: dict, on: bool) -> None:
        return None

    def set_brightness(self, device: dict, value: int) -> None:
        return None

    def set_color(self, device: dict, r: int, g: int, b: int) -> None:
        return None

    def set_color_temp(self, device: dict, kelvin: int) -> None:
        return None


REGISTRY: dict[str, Protocol] = {
    LexmanProtocol.name: LexmanProtocol(),
    MockProtocol.name: MockProtocol(),
    TemplateProtocol.name: TemplateProtocol(),
}


def get_protocol(name: str) -> Optional[Protocol]:
    return REGISTRY.get(name)
