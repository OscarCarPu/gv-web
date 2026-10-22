import * as z from 'zod';
import { fetchAPI } from '$shared/api/client';
import { ReportStatusSchema } from './report.schemas';

export const reportApi = {
	status: (token?: string) => fetchAPI('/report', ReportStatusSchema, { token }),

	dismiss: () => fetchAPI('/report', z.void(), { method: 'DELETE' }),
};
