import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
  HabitWithLogListSchema,
  CreateHabitResponseSchema,
  LogUpsertResponseSchema,
  HabitHistorySchema,
} from './habits.schemas';
import type {
  HabitWithLog,
  CreateHabitRequest,
  LogUpsertRequest,
  HabitHistoryResponse,
} from '../types/Habit.types';

export const habitsApi = {
  async getHabits(date?: string, token?: string): Promise<HabitWithLog[]> {
    const query = date ? `?date=${date}` : '';
    return fetchAPI(`/habits${query}`, HabitWithLogListSchema, { token });
  },

  async createHabit(input: CreateHabitRequest, token?: string): Promise<{ id: number; name: string; description: string | null }> {
    return fetchAPI('/habits', CreateHabitResponseSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      token
    });
  },

  async logHabit(input: LogUpsertRequest, token?: string): Promise<{ status: string }> {
    return fetchAPI('/habits/log', LogUpsertResponseSchema, {
      method: 'POST',
      body: JSON.stringify(input),
      token
    });
  },

  async deleteHabit(id: number, token?: string): Promise<void> {
    return fetchAPI(`/habits/${id}`, z.void(), {
      method: 'DELETE',
      token
    });
  },

  async getHistory(
    id: number,
    params: { frequency?: string; start_at?: string; end_at?: string },
    token?: string
  ): Promise<HabitHistoryResponse> {
    const query = new URLSearchParams();
    if (params.frequency) query.set('frequency', params.frequency);
    if (params.start_at) query.set('start_at', params.start_at);
    if (params.end_at) query.set('end_at', params.end_at);
    const qs = query.toString();
    return fetchAPI(`/habits/${id}/history${qs ? '?' + qs : ''}`, HabitHistorySchema, { token });
  }
};
