import { z } from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
  HabitSchema,
  HabitLogSchema,
  PaginatedHabitsSchema,
  PaginatedLogsSchema,
  DayStatsListSchema,
} from './habits.schemas';
import type {
  Habit,
  HabitLog,
  HabitDayStats,
  PaginatedResponse,
  CreateHabitInput,
  UpdateHabitInput,
  CreateLogInput,
  UpdateLogInput
} from '../types/Habit.types';

export const habitsApi = {
  async getAll(page = 1, pageSize = 20): Promise<PaginatedResponse<Habit>> {
    return fetchAPI(`/habits?page=${page}&page_size=${pageSize}`, PaginatedHabitsSchema);
  },

  async getDay(date?: string): Promise<HabitDayStats[]> {
    const query = date ? `?target_date=${date}` : '';
    return fetchAPI(`/habits/daily${query}`, DayStatsListSchema);
  },

  async getById(id: number): Promise<Habit> {
    return fetchAPI(`/habits/${id}`, HabitSchema);
  },

  async create(input: CreateHabitInput): Promise<Habit> {
    return fetchAPI('/habits', HabitSchema, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async update(id: number, input: UpdateHabitInput): Promise<Habit> {
    return fetchAPI(`/habits/${id}`, HabitSchema, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
  },

  async delete(id: number): Promise<void> {
    await fetchAPI(`/habits/${id}`, z.void(), {
      method: 'DELETE'
    });
  },


  async getLogs(
    habitId: number,
    page = 1,
    pageSize = 20,
    startDate?: string,
    endDate?: string
  ): Promise<PaginatedResponse<HabitLog>> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return fetchAPI(`/habits/${habitId}/logs?${params.toString()}`, PaginatedLogsSchema);
  },

  async createLog(habitId: number, input: CreateLogInput): Promise<HabitLog> {
    return fetchAPI(`/habits/${habitId}/logs`, HabitLogSchema, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async upsertLog(habitId: number, input: CreateLogInput): Promise<HabitLog> {
    return fetchAPI(`/habits/${habitId}/logs`, HabitLogSchema, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },

  async updateLog(habitId: number, logId: number, input: UpdateLogInput): Promise<HabitLog> {
    return fetchAPI(`/habits/${habitId}/logs/${logId}`, HabitLogSchema, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
  },

  async deleteLog(habitId: number, logId: number): Promise<void> {
    await fetchAPI(`/habits/${habitId}/logs/${logId}`, z.void(), {
      method: 'DELETE'
    });
  },

  async modifyLog(habitId: number, input: CreateLogInput): Promise<HabitLog> {
    return fetchAPI(`/habits/${habitId}/logs/modify`, HabitLogSchema, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
};
