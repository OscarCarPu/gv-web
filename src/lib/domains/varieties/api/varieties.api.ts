import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import { VarietyResponseSchema, VarietyResponseListSchema } from './varieties.schemas';
import type { Variety, CreateVarietyRequest, UpdateVarietyRequest } from '../types/Variety.types';

export const varietiesApi = {
	async listVarieties(token?: string): Promise<Variety[]> {
		return fetchAPI('/varieties', VarietyResponseListSchema, { token });
	},

	async getVariety(id: number, token?: string): Promise<Variety> {
		return fetchAPI(`/varieties/${id}`, VarietyResponseSchema, { token });
	},

	async createVariety(input: CreateVarietyRequest, token?: string): Promise<Variety> {
		return fetchAPI('/varieties', VarietyResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateVariety(id: number, input: UpdateVarietyRequest, token?: string): Promise<Variety> {
		return fetchAPI(`/varieties/${id}`, VarietyResponseSchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteVariety(id: number, token?: string): Promise<void> {
		return fetchAPI(`/varieties/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},
};
