import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLight, readState, sendCommand } from '$lib/server/domotics/lights/registry';
import type { LightCommand } from '$lib/server/domotics/lights/types';

/** Current state of one bulb. `?force=1` skips the read cache. */
export const GET: RequestHandler = async ({ params, url }) => {
	const light = getLight(params.id);
	if (!light) return json({ error: 'Light not found' }, { status: 404 });

	return json(await readState(light, url.searchParams.get('force') === '1'));
};

/**
 * Apply one command. Validated here rather than in the driver so every driver —
 * including the out-of-process bridge — can trust what it receives.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const light = getLight(params.id);
	if (!light) return json({ error: 'Light not found' }, { status: 404 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Body must be JSON' }, { status: 400 });
	}

	const command = parseCommand(body);
	if (typeof command === 'string') return json({ error: command }, { status: 400 });

	return json(await sendCommand(light, command));
};

function parseCommand(body: unknown): LightCommand | string {
	if (typeof body !== 'object' || body === null) return 'Body must be an object';
	const raw = body as Record<string, unknown>;

	switch (raw.type) {
		case 'power':
			if (typeof raw.on !== 'boolean') return '"on" must be a boolean';
			return { type: 'power', on: raw.on };

		case 'brightness': {
			const value = Number(raw.value);
			if (!Number.isFinite(value) || value < 0 || value > 100)
				return '"value" must be a number between 0 and 100';
			return { type: 'brightness', value };
		}

		case 'color': {
			const color = raw.color as Record<string, unknown> | undefined;
			if (typeof color !== 'object' || color === null) return '"color" must be an object';
			const channels = ['r', 'g', 'b'] as const;
			const rgb = { r: 0, g: 0, b: 0 };
			for (const channel of channels) {
				const n = Number(color[channel]);
				if (!Number.isFinite(n) || n < 0 || n > 255)
					return `"color.${channel}" must be a number between 0 and 255`;
				rgb[channel] = n;
			}
			return { type: 'color', color: rgb };
		}

		case 'colorTemp': {
			const kelvin = Number(raw.kelvin);
			// Bounds are per-bulb and the driver clamps; this only rejects nonsense.
			if (!Number.isFinite(kelvin) || kelvin < 1000 || kelvin > 20000)
				return '"kelvin" must be a plausible colour temperature';
			return { type: 'colorTemp', kelvin };
		}

		default:
			return 'Unknown command type';
	}
}
