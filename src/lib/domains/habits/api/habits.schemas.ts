import { z } from 'zod';

export const HabitWithLogSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  log_value: z.number().nullable(),
  frequency: z.string(),
  target_min: z.number().nullable(),
  target_max: z.number().nullable(),
  recording_required: z.boolean(),
  period_value: z.number(),
  current_streak: z.number(),
  longest_streak: z.number()
});

export const HabitWithLogListSchema = z.array(HabitWithLogSchema).nullable().transform(v => v ?? []);

export const CreateHabitResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  frequency: z.string(),
  target_min: z.number().nullable(),
  target_max: z.number().nullable(),
  recording_required: z.boolean()
});

export const LogUpsertResponseSchema = z.object({
  status: z.string()
});

export const HabitHistorySchema = z.object({
  start_at: z.string(),
  end_at: z.string(),
  data: z.array(z.object({ date: z.string(), value: z.number() }))
});
