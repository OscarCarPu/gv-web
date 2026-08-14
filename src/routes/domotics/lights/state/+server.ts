import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAllStates } from '$lib/server/domotics/lights/registry';

/** Poll target for the Lights tab. `?force=1` skips the read cache. */
export const GET: RequestHandler = async ({ url }) => {
	const force = url.searchParams.get('force') === '1';
	return json({ states: await readAllStates(force) });
};
