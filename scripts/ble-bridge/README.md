# BLE bridge

Bluetooth for the **Domotics → Lights** section. gv-api drives it; this daemon owns the radio.

## Why it exists

The app runs in Docker on a server with **no Bluetooth radio at all** — no adapter, no
bluez, no `/sys/class/bluetooth`. Even with a dongle plugged in, speaking BLE from the web
container would mean handing it the host's D-Bus and network namespace. So the radio work
lives in a small daemon on any LAN machine that _does_ have Bluetooth, and gv-web talks to
it over HTTP:

```
gv-api  ──HTTP──▶  bridge.py  ──D-Bus/BlueZ──▶  bulb
```

It has to be a long-running daemon rather than a one-shot command. BlueZ cancels a
`StartNotify` subscription the instant the D-Bus client that asked for it leaves the bus,
so `gdbus` and one-shot `bluetoothctl` report success while `Notifying` stays `false` and
no notification ever arrives. Reading these bulbs back needs a live bus connection and a
running main loop — which is what a daemon is.

## Requirements

The standard library plus **PyGObject** (`gi`), which ships with the distro. No pip
installs. `bleak` is deliberately not used: it is not installed here, `python-dbus` is
broken on this machine (`dbus.SystemBus` missing), and Gio works.

## Running

### Docker (how it actually runs)

```bash
cd scripts/ble-bridge
echo "LIGHTS_BRIDGE_TOKEN=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')" > .env
docker compose up -d --build
```

Started by hand it dies with the terminal and does not come back after a reboot — which is
exactly how the first night of this ended. The bridge host runs runit with **no systemd
user session**, but `docker`, `dbus` and `bluetoothd` are all already boot services, so
`restart: unless-stopped` is what makes it durable.

The container needs no privileges, no `/dev` access and no bluez packages: `bluetoothd`
runs on the host and everything reaches it over the mounted D-Bus socket. It does run as
**root**, because BlueZ's D-Bus policy grants `GattCharacteristic1` / `Properties` /
`ObjectManager` to root only — the default context may merely address `org.bluez`, so an
unprivileged user gets `rejected send message` on the first write.

Note that `docker kill`/`docker stop` flag a container as _user-stopped_, and
`unless-stopped` deliberately will not bring one of those back at boot. After either, run
`docker compose up -d` to clear the flag.

### Directly (development, one-offs)

```bash
python3 scripts/ble-bridge/bridge.py --token "$LIGHTS_BRIDGE_TOKEN"
python3 scripts/ble-bridge/bridge.py --mock   # no radio needed
python3 scripts/ble-bridge/bridge.py -v       # connect/disconnect churn + tracebacks
```

### Wiring the API to it

**gv-api owns the lights**, not this app — the bridge lives in this repo only because it is a
deployment artefact of it. Configure it in gv-api's `.env` (both the local one and the lab's
`~/docker/gv/gv-api/.env`); see `gv-api/docs/api/lights.md`.

```
LIGHTS_DRIVER=bridge
LIGHTS_BRIDGE_URL=http://<bridge-host>:8477
LIGHTS_BRIDGE_TOKEN=<same token as scripts/ble-bridge/.env>
```

Without a token the bridge accepts any caller on the LAN. Fine for a quick test, wrong to
leave running.

**The Lights tab only works while the bridge host is up.** The API server has no radio, so if
that machine sleeps or leaves the network every bulb reports `online: false` with a connection
error — a symptom of the bridge being unreachable, not of a bulb fault.

## Adding a bulb

```bash
python3 scripts/ble-bridge/bridge.py --scan                     # addresses + names in range
python3 scripts/ble-bridge/bridge.py --inspect AA:BB:CC:DD:EE:FF  # its GATT table
```

The characteristic you want is almost always the single `write` handle on a vendor service
— a 128-bit UUID that is _not_ of the standard `0000xxxx-0000-1000-8000-00805f9b34fb`
form. Copy `TemplateProtocol` in `protocols.py`, encode the payloads, and register it in
`REGISTRY`. Then add the bulb to gv-web's `LIGHTS` env with `"protocol": "<your name>"`.

## Supported models

### LEXMAN / Adeo ZBEK-13 "CCT smart bulb" (`protocol: "lexman"`)

Tunable white, no RGB. Sold by Leroy Merlin under LEXMAN, paired in the Enki app. Frame
format from [lexman-ble](https://github.com/davidsmfreire/lexman-ble); the UUIDs there
match this bulb exactly.

- write `0000a101-1115-1000-0001-617573746f6d`, notify `0000a102-…`
- brightness `0–254`, colour temperature in mireds `153` (cool) – `454` (warm)
- plain BLE, **no pairing** — `Connect` is enough

Quirks worth knowing, all observed on the real bulb:

- The first connection often dies with `le-connection-abort-by-local` partway through
  service discovery. The retry almost always gets in — `connect()` does this for you.
- It accepts **one central at a time**. With the Enki app connected on a phone the bulb
  stops advertising and is invisible to a scan.
- Writing a value it already holds produces **no notification at all**, and some
  temperature steps stay silent mid-transition. A missing notification is therefore never
  treated as a failure.
- The `ZB` in the model name means it also speaks Zigbee, so Zigbee2MQTT/ZHA is a viable
  alternative path if BLE ever proves too flaky.

## HTTP API

| Method | Path       | Body / query        | Returns                              |
| ------ | ---------- | ------------------- | ------------------------------------ |
| GET    | `/health`  | —                   | `{ok, backend, protocols, devices}`  |
| POST   | `/state`   | `{device}`          | light state                          |
| POST   | `/command` | `{device, command}` | light state                          |
| GET    | `/scan`    | `?seconds=8`        | `{devices: [{address, name, rssi}]}` |
| GET    | `/inspect` | `?address=…`        | `{services: […]}`                    |

`device` is `{"id", "address", "protocol", "options"}` and `command` is one of
`{"type":"power","on":bool}`, `{"type":"brightness","value":0-100}`,
`{"type":"color","color":{"r","g","b"}}`, `{"type":"colorTemp","kelvin":int}` — the same shapes
`gv-api/internal/lights/dto.go` declares, so the driver on the API side is a straight
pass-through.

Errors never surface as HTTP failures: an unreachable bulb comes back `200` with
`"online": false` and an `error` string, so one dead bulb cannot blank the whole tab.

## Design notes

- **State cache.** The bridge keeps its own record of what it last wrote per device, and
  merges it with whatever the bulb confirms. Bulbs that cannot be read at all (`readable
= False`) are served entirely from it.
- **Per-device lock.** Two overlapping GATT writes to one peripheral tend to fail both, so
  every command for an address is serialised.
- **Idle disconnect.** Links are dropped after 90s unused, because these bulbs allow a
  single central and holding on locks out their own remote and the vendor app.
- **Characteristics resolved by UUID**, never by BlueZ's `serviceXXXX/charXXXX` path.
  That numbering is a cache artefact — stable most of the time, silently different after
  a re-pair or an adapter reset.
