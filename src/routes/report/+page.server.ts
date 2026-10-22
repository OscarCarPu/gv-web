import type { PageServerLoad } from './$types';
import { reportApi } from '$lib/domains/report/api/report.api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { status: await reportApi.status(locals.token) };
	} catch {
		return { status: null };
	}
};
