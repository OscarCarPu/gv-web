import { z } from 'zod';

export const ValueTypeSchema = z.enum(['boolean', 'numeric']);
export const TargetFrequencySchema = z.enum(['daily', 'weekly', 'monthly']);
export const ComparisonTypeSchema = z.enum([
  'equals',
  'greater_than',
  'less_than',
  'greater_equal_than',
  'less_equal_than',
  'in_range'
]);

export const HabitSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  value_type: ValueTypeSchema,
  unit: z.string().nullable(),
  frequency: TargetFrequencySchema,
  target_value: z.string().nullable(),
  target_min: z.string().nullable(),
  target_max: z.string().nullable(),
  comparison_type: ComparisonTypeSchema.nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  default_value: z.coerce.number().nullable(),
  streak_strict: z.boolean(),
  icon: z.string(),
  big_step: z.string().nullable(),
  small_step: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const HabitLogSchema = z.object({
  id: z.number(),
  habit_id: z.number(),
  log_date: z.string(),
  value: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

export const HabitDayStatsSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  value_type: ValueTypeSchema,
  unit: z.string().nullable(),
  frequency: TargetFrequencySchema,
  target_value: z.coerce.number().nullable(),
  target_min: z.coerce.number().nullable(),
  target_max: z.coerce.number().nullable(),
  comparison_type: ComparisonTypeSchema.nullable(),
  default_value: z.coerce.number().nullable(),
  streak_strict: z.boolean(),
  icon: z.string(),
  current_streak: z.number().nullable(),
  longest_streak: z.number().nullable(),
  average_value: z.coerce.number().nullable(),
  average_completion_rate: z.coerce.number().nullable(),
  current_period_value: z.coerce.number().nullable(),
  date_value: z.coerce.number().nullable(),
  big_step: z.coerce.number().nullable(),
  small_step: z.coerce.number().nullable()
});

export const PaginatedHabitsSchema = z.object({
  items: z.array(HabitSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  total_pages: z.number()
});

export const PaginatedLogsSchema = z.object({
  items: z.array(HabitLogSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  total_pages: z.number()
});


export const DayStatsListSchema = z.array(HabitDayStatsSchema);
