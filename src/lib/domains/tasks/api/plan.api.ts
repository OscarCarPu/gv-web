import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	PlanBlockResponseSchema,
	PlanTodayResponseSchema,
	PlanRangeResponseSchema,
	RecurringCommitmentResponseSchema,
	RecurringCommitmentListSchema,
} from './plan.schemas';
import type {
	PlanBlockResponse,
	PlanTodayResponse,
	PlanRangeResponse,
	CreatePlanBlockRequest,
	UpdatePlanBlockRequest,
	RecurringCommitmentResponse,
	CreateCommitmentRequest,
	UpdateCommitmentRequest,
} from '$lib/domains/tasks/types/Plan.types';

export const planApi = {
	async getToday(token?: string): Promise<PlanTodayResponse> {
		return fetchAPI('/plan/today', PlanTodayResponseSchema, { token });
	},

	async getRange(from: string, to: string, token?: string): Promise<PlanRangeResponse> {
		const query = new URLSearchParams({ from, to });
		return fetchAPI(`/plan/range?${query}`, PlanRangeResponseSchema, { token });
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

	async listCommitments(token?: string): Promise<RecurringCommitmentResponse[]> {
		return fetchAPI('/plan/commitments', RecurringCommitmentListSchema, { token });
	},

	async createCommitment(
		input: CreateCommitmentRequest,
		token?: string
	): Promise<RecurringCommitmentResponse> {
		return fetchAPI('/plan/commitments', RecurringCommitmentResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateCommitment(
		id: number,
		input: UpdateCommitmentRequest,
		token?: string
	): Promise<RecurringCommitmentResponse> {
		return fetchAPI(`/plan/commitments/${id}`, RecurringCommitmentResponseSchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteCommitment(id: number, token?: string): Promise<void> {
		return fetchAPI(`/plan/commitments/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},
};
