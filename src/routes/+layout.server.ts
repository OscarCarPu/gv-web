import { redirect } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import type { LayoutServerLoad } from './$types';
import { failoverStatus } from '$lib/server/failoverStatus';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const failover = locals.token ? await failoverStatus(locals.token) : null;
	if (failover?.locked && !url.pathname.startsWith('/report')) {
		redirect(StatusCodes.SEE_OTHER, '/report');
	}
	return {
		token: locals.token,
		semiprivateToken: locals.semiprivateToken,
		showReport: !!failover && (failover.locked || failover.report),
	};
};
