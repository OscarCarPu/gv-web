import { fetchAPI } from '$lib/shared/api/client';
import {
  HabitWithLogListSchema,
  CreateHabitResponseSchema,
  LogUpsertResponseSchema,
} from './habits.schemas';
import type {
  HabitWithLog,
  CreateHabitRequest,
  LogUpsertRequest,
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
  }
};
