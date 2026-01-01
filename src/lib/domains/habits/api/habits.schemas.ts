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
  is_required: z.boolean(),
  icon: z.string(),
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
  value_type: ValueTypeSchema,
  unit: z.string().nullable(),
  frequency: TargetFrequencySchema,
  target_value: z.coerce.number().nullable(),
  comparison_type: ComparisonTypeSchema.nullable(),
  is_required: z.boolean(),
  icon: z.string(),
  current_streak: z.number(),
  longest_streak: z.number(),
  average_value: z.coerce.number().nullable(),
  average_completion_rate: z.coerce.number(),
  current_period_value: z.coerce.number().nullable(),
  date_value: z.coerce.number().nullable()
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

export const HistoryPeriodSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  total_value: z.string()
});

export const HabitHistorySchema = z.object({
  habit_id: z.number(),
  time_period: z.string(),
  periods: z.array(HistoryPeriodSchema)
});

export const DayStatsListSchema = z.array(HabitDayStatsSchema);
