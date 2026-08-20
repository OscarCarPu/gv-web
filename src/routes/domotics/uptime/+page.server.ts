import type { PageServerLoad } from './$types';
import { uptimeApi } from '$lib/domains/domotics/uptime/api/uptime.api';
import { rangeFor } from '$lib/domains/domotics/uptime/uptime.svelte';

export const load: PageServerLoad = async ({ locals }) => {
	// Semiprivate route: either tier's token gets in.
	const token = locals.token ?? locals.semiprivateToken;

	// Both reads are indexed lookups against a mart, so SSR them together and let the tab
	// paint complete. A failure here is not fatal to the page: gv-api answers 503 when no
	// pipeline database is configured, and the tab has to be able to say so.
	const [overview, report] = await Promise.all([
		uptimeApi.overview(token).catch((e) => ({ error: message(e) }) as const),
		uptimeApi.windows(rangeFor('30d'), token).catch(() => null),
	]);

	if ('error' in overview) {
		return { overview: null, report: null, error: overview.error };
	}
	return { overview, report, error: null };
};

function message(e: unknown): string {
	return e instanceof Error ? e.message : 'failed to read uptime';
}
