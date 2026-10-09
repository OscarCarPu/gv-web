import { fetchAPI } from '$lib/shared/api/client';
import { PrinterListSchema } from './printers.schemas';

export const printersApi = {
	async list(token?: string) {
		return fetchAPI('/domotics/printers', PrinterListSchema, { token });
	},
};
