import type { PageServerLoad } from './$types';
import { lightsApi } from '$lib/domains/domotics/lights/api/lights.api';

export const load: PageServerLoad = async ({ locals }) => {
	// Semiprivate route: either tier's token gets in.
	const token = locals.token ?? locals.semiprivateToken;

	// SSR the first read so the tab paints with real state, but never let a slow radio hold the
	// page: a cold BLE connect can take ten seconds, and the client's first poll fills in
	// whatever missed the cut. The two run together — `lights` alone is cheap, it touches no
	// hardware, and waiting for it first would eat into the state read's budget.
	const [lights, states] = await Promise.all([
		lightsApi.list(token).catch(() => []),
		withTimeout(lightsApi.states(token), 1500).catch(() => []),
	]);

	return { lights, states };
};

/** Reject if the promise outlives `ms`; the caller decides what that means. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			timer = setTimeout(() => reject(new Error('timed out')), ms);
		}),
		// Clear the timer either way: the losing branch of a race is not cancelled, and a
		// pending timeout keeps the request's event loop work alive for no reason.
	]).finally(() => clearTimeout(timer));
}
