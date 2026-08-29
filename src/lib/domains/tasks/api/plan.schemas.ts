import * as z from 'zod';
import { TimeEntrySummaryResponseSchema } from './tasks.schemas';

export const PlanBlockResponseSchema = z.object({
	id: z.number(),
	plan_date: z.string(),
	started_at: z.string(),
	ended_at: z.string(),
	task_id: z.number().nullable(),
	task_name: z.string().nullable(),
	label: z.string(),
	note: z.string().nullable(),
	event_ref: z.string().nullable(),
	commitment_id: z.number().nullable(),
	task_type: z.string().nullable().optional(),
	task_recurrence: z.number().nullable().optional(),
	task_started_at: z.string().nullable().optional(),
	task_finished_at: z.string().nullable().optional(),
});

export const PlanRangeResponseSchema = z.object({
	from: z.string(),
	to: z.string(),
	blocks: z
		.array(PlanBlockResponseSchema)
		.nullable()
		.transform((v) => v ?? []),
});

export const RecurringCommitmentResponseSchema = z.object({
	id: z.number(),
	task_id: z.number(),
	task_name: z.string(),
	label: z.string(),
	days_of_week: z.array(z.number()),
	start_time: z.string(),
	end_time: z.string(),
	active: z.boolean(),
});

export const RecurringCommitmentListSchema = z
	.array(RecurringCommitmentResponseSchema)
	.nullable()
	.transform((v) => v ?? []);

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
