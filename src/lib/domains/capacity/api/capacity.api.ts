import { fetchAPI } from '$lib/shared/api/client';
import { FreeBusyRangeResponseSchema } from './capacity.schemas';
import type { FreeBusyRangeResponse } from '$lib/domains/capacity/types/Capacity.types';

export const capacityApi = {
	async getFreeBusy(from: string, to: string, token?: string): Promise<FreeBusyRangeResponse> {
		const query = new URLSearchParams({ from, to });
		return fetchAPI(`/capacity/free-busy?${query}`, FreeBusyRangeResponseSchema, { token });
	},
};
