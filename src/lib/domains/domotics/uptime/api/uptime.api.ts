import { fetchAPI } from '$lib/shared/api/client';
import {
	OverviewSchema,
	WindowsReportSchema,
	type Device,
	type Overview,
	type WindowsReport,
} from './uptime.schemas';

/**
 * Uptime lives in gv-api, which reads it from central-pipeline's marts — this app is only
 * an interface over it. No gv-web server route in front: the browser calls gv-api with the
 * session token, like lights.
 *
 * Both endpoints answer 503 when no pipeline database is configured, which fetchAPI turns
 * into a thrown error carrying the API's message.
 */
export const uptimeApi = {
	/** Current state per device plus the four precomputed lookbacks. One read per table. */
	async overview(token?: string): Promise<Overview> {
		return fetchAPI('/domotics/uptime', OverviewSchema, { token });
	},

	/**
	 * State changes over an arbitrary range, with the percentage computed for exactly that
	 * range. `from`/`to` are ISO strings; omitting them asks for the last 30 days.
	 */
	async windows(
		params: { from?: string; to?: string; device?: Device; limit?: number } = {},
		token?: string
	): Promise<WindowsReport> {
		const query = new URLSearchParams();
		if (params.from) query.set('from', params.from);
		if (params.to) query.set('to', params.to);
		if (params.device) query.set('device', params.device);
		if (params.limit) query.set('limit', String(params.limit));
		const suffix = query.size > 0 ? `?${query}` : '';
		return fetchAPI(`/domotics/uptime/windows${suffix}`, WindowsReportSchema, { token });
	},
};
