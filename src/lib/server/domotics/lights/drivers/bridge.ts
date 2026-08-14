// Talks to the BLE bridge daemon (scripts/ble-bridge/) over HTTP.
//
// Why a bridge instead of speaking BLE from this process: the app runs in Docker on a
// server with no Bluetooth radio at all — no adapter, no bluez, no /sys/class/bluetooth.
// Even with a dongle, BlueZ needs the host's DBus and a host network namespace, which
// would mean giving the web container far more of the host than it should have. The
// bridge is a tiny daemon on any machine that does have a radio and is on the LAN.
//
//   LIGHTS_DRIVER=bridge
//   LIGHTS_BRIDGE_URL=http://192.168.1.50:8477   (see .env.example)
//   LIGHTS_BRIDGE_TOKEN=<shared secret>

import {
	offlineState,
	type LightCommand,
	type LightConfig,
	type LightDriver,
	type LightState,
} from '../types';

// A cold call is slow and legitimately so: when BlueZ has dropped an unbonded bulb's
// object it must rediscover it (~8s) before it can even connect, and a full read is
// three round-trips after that — measured at ~11s. Anything under ~20s aborts reads that
// would have succeeded. Warm calls come back in well under a second.
const DEFAULT_TIMEOUT_MS = 20000;

function bridgeUrl(): string | null {
	const url = process.env.LIGHTS_BRIDGE_URL?.trim();
	return url ? url.replace(/\/+$/, '') : null;
}

function timeoutMs(): number {
	const raw = Number(process.env.LIGHTS_BRIDGE_TIMEOUT_MS);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** The bridge knows nothing about our registry — every request carries the bulb it applies to. */
function devicePayload(light: LightConfig) {
	return {
		id: light.id,
		address: light.address,
		protocol: light.protocol,
		options: light.options ?? {},
	};
}

async function call(
	light: LightConfig,
	path: string,
	body: Record<string, unknown>
): Promise<LightState> {
	const base = bridgeUrl();
	if (!base) {
		return offlineState(light, 'LIGHTS_BRIDGE_URL is not set');
	}

	const token = process.env.LIGHTS_BRIDGE_TOKEN?.trim();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;

	try {
		const res = await fetch(`${base}${path}`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ device: devicePayload(light), ...body }),
			signal: AbortSignal.timeout(timeoutMs()),
		});

		if (!res.ok) {
			const detail = (await res.text().catch(() => '')).slice(0, 200);
			return offlineState(light, `bridge ${res.status}${detail ? `: ${detail}` : ''}`);
		}

		const data = (await res.json()) as Partial<LightState> & { error?: string };
		// The bridge reports the bulb's truth; identity and capabilities stay ours.
		return {
			...offlineState(light, ''),
			...data,
			id: light.id,
			name: light.name,
			model: light.model,
			supportsColor: light.supportsColor,
			supportsColorTemp: light.supportsColorTemp,
			online: data.online ?? true,
			error: data.error || undefined,
			updatedAt: Date.now(),
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		// Never throw: one unreachable bulb must not blank the whole tab.
		return offlineState(light, message.includes('timed out') ? 'bridge timed out' : message);
	}
}

export const bridgeDriver: LightDriver = {
	kind: 'bridge',

	getState(light) {
		return call(light, '/state', {});
	},

	apply(light, command: LightCommand) {
		return call(light, '/command', { command });
	},
};
