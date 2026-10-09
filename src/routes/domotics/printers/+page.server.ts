import type { PageServerLoad } from './$types';
import { printersApi } from '$lib/domains/domotics/printers/api/printers.api';

export const load: PageServerLoad = async ({ locals }) => {
	const token = locals.token ?? locals.semiprivateToken;
	return { printers: await printersApi.list(token).catch(() => []) };
};
