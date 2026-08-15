import type { PageServerLoad } from './$types';
import { lightsApi } from '$lib/domains/domotics/lights/api/lights.api';

export const load: PageServerLoad = async ({ locals }) => {
	// Semiprivate route: either tier's token gets in.
	const token = locals.token ?? locals.semiprivateToken;

	// SSR the first read so the tab paints with real state, but never let a slow radio hold
	// the page: a cold BLE connect can take ten seconds, and the client's first poll fills in
	// whatever missed the cut. `lights` alone is cheap — it touches no hardware.
	const lights = await lightsApi.list(token).catch(() => []);
	const states = await withTimeout(lightsApi.states(token), 1500).catch(() => []);

	return { lights, states };
};

/** Resolve to null if the promise outlives `ms`; the caller decides what that means. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
	]);
}
