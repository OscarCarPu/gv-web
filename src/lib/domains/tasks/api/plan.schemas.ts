import * as z from 'zod';
import { TimeEntrySummaryResponseSchema } from './tasks.schemas';

export const PlanBlockResponseSchema = z.object({
	id: z.number(),
	started_at: z.string(),
	ended_at: z.string(),
	task_id: z.number().nullable(),
	task_name: z.string().nullable(),
	label: z.string(),
	note: z.string().nullable(),
	task_type: z.string().nullable().optional(),
	task_recurrence: z.number().nullable().optional(),
	task_started_at: z.string().nullable().optional(),
	task_finished_at: z.string().nullable().optional(),
});

const PlanTotalsSchema = z.object({
	task_seconds: z.number(),
	free_seconds: z.number(),
});

export const PlanTodayResponseSchema = z.object({
	date: z.string(),
	blocks: z
		.array(PlanBlockResponseSchema)
		.nullable()
		.transform((v) => v ?? []),
	totals: PlanTotalsSchema,
	budget: TimeEntrySummaryResponseSchema,
});
