import { z } from 'zod';

export const HabitWithLogSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  log_value: z.number().nullable()
});

export const HabitWithLogListSchema = z.array(HabitWithLogSchema);

export const CreateHabitResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable()
});

export const LogUpsertResponseSchema = z.object({
  status: z.string()
});
