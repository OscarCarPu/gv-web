import type { PageServerLoad } from './$types';
import { listLights } from '$lib/server/domotics/lights/config';
import { readAllStatesOrKnown } from '$lib/server/domotics/lights/registry';

export const load: PageServerLoad = async () => {
	// SSR the first read so the tab paints with real state instead of flashing placeholders,
	// but never wait long for it — a cold BLE connect can take ten seconds and the page
	// would sit blank throughout. The client's first poll fills in whatever missed the cut.
	// Drivers never throw, so an unreachable bulb arrives as online:false, not a 500.
	return {
		lights: listLights(),
		states: await readAllStatesOrKnown(),
		driver: process.env.LIGHTS_DRIVER ?? 'mock',
	};
};
