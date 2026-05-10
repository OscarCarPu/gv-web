import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import { PlanBlockResponseSchema, PlanTodayResponseSchema } from './plan.schemas';
import type {
	PlanBlockResponse,
	PlanTodayResponse,
	CreatePlanBlockRequest,
	UpdatePlanBlockRequest,
} from '$lib/domains/tasks/types/Plan.types';

export const planApi = {
	async getToday(token?: string): Promise<PlanTodayResponse> {
		return fetchAPI('/plan/today', PlanTodayResponseSchema, { token });
	},

	async createBlock(input: CreatePlanBlockRequest, token?: string): Promise<PlanBlockResponse> {
		return fetchAPI('/plan/blocks', PlanBlockResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateBlock(
		id: number,
		input: UpdatePlanBlockRequest,
		token?: string
	): Promise<PlanBlockResponse> {
		return fetchAPI(`/plan/blocks/${id}`, PlanBlockResponseSchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteBlock(id: number, token?: string): Promise<void> {
		return fetchAPI(`/plan/blocks/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	async deleteFutureBlocks(token?: string): Promise<void> {
		return fetchAPI('/plan/blocks/future', z.void(), {
			method: 'DELETE',
			token,
		});
	},
};
