import { fetchAPI } from '$lib/shared/api/client';
import {
	OverviewSchema,
	WindowsReportSchema,
	type Overview,
	type WindowsReport,
} from './uptime.schemas';

export const uptimeApi = {
	async overview(token?: string): Promise<Overview> {
		return fetchAPI('/domotics/uptime', OverviewSchema, { token });
	},

	async windows(
		params: { from?: string; to?: string; limit?: number } = {},
		token?: string
	): Promise<WindowsReport> {
		const query = new URLSearchParams();
		if (params.from) query.set('from', params.from);
		if (params.to) query.set('to', params.to);
		if (params.limit) query.set('limit', String(params.limit));
		const suffix = query.size > 0 ? `?${query}` : '';
		return fetchAPI(`/domotics/uptime/windows${suffix}`, WindowsReportSchema, { token });
	},
};
