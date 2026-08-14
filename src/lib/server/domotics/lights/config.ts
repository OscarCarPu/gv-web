// Server-only bulb registry. BLE addresses live here and never reach the client —
// the browser only ever sees ids and display names.
//
// Configure with LIGHTS: a JSON array read at startup, so adding a bulb is an env
// change and a restart, no code edit:
//
//   LIGHTS='[{"id":"desk","name":"Desk","model":"...","address":"AA:BB:CC:DD:EE:FF","protocol":"..."}]'
//
// With LIGHTS unset and LIGHTS_DRIVER=mock (the dev default) a small fake set is
// used so the UI is workable before any real hardware is paired.

import { DEFAULT_MAX_KELVIN, DEFAULT_MIN_KELVIN, type LightConfig } from './types';

const MOCK_LIGHTS: LightConfig[] = [
	{
		id: 'mock-desk',
		name: 'Desk lamp',
		model: 'Mock RGBW bulb',
		address: '00:00:00:00:00:01',
		protocol: 'mock',
		supportsColor: true,
		supportsColorTemp: true,
		minColorTemp: DEFAULT_MIN_KELVIN,
		maxColorTemp: DEFAULT_MAX_KELVIN,
	},
	{
		id: 'mock-ceiling',
		name: 'Ceiling light',
		model: 'Mock tunable white bulb',
		address: '00:00:00:00:00:02',
		protocol: 'mock',
		supportsColor: false,
		supportsColorTemp: true,
		minColorTemp: 2700,
		maxColorTemp: 6500,
	},
];

/** Fills in everything optional so drivers can read a complete LightConfig. */
function normalize(raw: Record<string, unknown>, index: number): LightConfig | null {
	const id = typeof raw.id === 'string' ? raw.id.trim() : '';
	const address = typeof raw.address === 'string' ? raw.address.trim() : '';
	if (!id || !address) {
		console.warn(`LIGHTS[${index}]: entries need both "id" and "address" — skipped`);
		return null;
	}

	const minColorTemp = Number(raw.minColorTemp ?? DEFAULT_MIN_KELVIN);
	const maxColorTemp = Number(raw.maxColorTemp ?? DEFAULT_MAX_KELVIN);

	return {
		id,
		name: typeof raw.name === 'string' && raw.name ? raw.name : id,
		model: typeof raw.model === 'string' && raw.model ? raw.model : 'BLE bulb',
		address,
		protocol: typeof raw.protocol === 'string' && raw.protocol ? raw.protocol : 'generic',
		supportsColor: raw.supportsColor !== false,
		supportsColorTemp: raw.supportsColorTemp !== false,
		minColorTemp: Number.isFinite(minColorTemp) ? minColorTemp : DEFAULT_MIN_KELVIN,
		maxColorTemp: Number.isFinite(maxColorTemp) ? maxColorTemp : DEFAULT_MAX_KELVIN,
		options:
			typeof raw.options === 'object' && raw.options
				? (raw.options as Record<string, unknown>)
				: undefined,
	};
}

function parseLights(): LightConfig[] {
	const raw = process.env.LIGHTS?.trim();
	if (!raw) {
		// Only fall back to fakes when there is no real driver behind them, so a
		// misconfigured production deploy shows an empty tab instead of phantom bulbs.
		return (process.env.LIGHTS_DRIVER ?? 'mock') === 'mock' ? MOCK_LIGHTS : [];
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		console.error('LIGHTS is not valid JSON — no bulbs configured:', (e as Error).message);
		return [];
	}

	if (!Array.isArray(parsed)) {
		console.error('LIGHTS must be a JSON array — no bulbs configured');
		return [];
	}

	const lights: LightConfig[] = [];
	const seen = new Set<string>();
	parsed.forEach((entry, i) => {
		if (typeof entry !== 'object' || entry === null) return;
		const light = normalize(entry as Record<string, unknown>, i);
		if (!light) return;
		if (seen.has(light.id)) {
			console.warn(`LIGHTS[${i}]: duplicate id "${light.id}" — skipped`);
			return;
		}
		seen.add(light.id);
		lights.push(light);
	});
	return lights;
}

const LIGHTS = parseLights();

/** Public list (no addresses) safe to send to the browser. */
export function listLights() {
	return LIGHTS.map(
		({ id, name, model, supportsColor, supportsColorTemp, minColorTemp, maxColorTemp }) => ({
			id,
			name,
			model,
			supportsColor,
			supportsColorTemp,
			minColorTemp,
			maxColorTemp,
		})
	);
}

/** Full configs, server-side only. */
export function allLights(): LightConfig[] {
	return LIGHTS;
}

export function getLight(id: string): LightConfig | undefined {
	return LIGHTS.find((l) => l.id === id);
}
