import { z } from 'zod';

// --- Base response schemas ---

export const ProjectResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	parent_id: z.number().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable()
});

export const TaskResponseSchema = z.object({
	id: z.number(),
	project_id: z.number().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable()
});

export const TodoResponseSchema = z.object({
	id: z.number(),
	task_id: z.number(),
	name: z.string(),
	is_done: z.boolean()
});

export const TimeEntryResponseSchema = z.object({
	id: z.number(),
	task_id: z.number(),
	started_at: z.string(),
	finished_at: z.string().nullable(),
	comment: z.string().nullable()
});

// --- Detail schemas ---

export const ProjectDetailResponseSchema = z.object({
	id: z.number(),
	parent_id: z.number().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	time_spent: z.number()
});

export const TaskDetailResponseSchema = z.object({
	id: z.number(),
	project_id: z.number().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	time_spent: z.number()
});

export const TaskFullResponseSchema = z.object({
	id: z.number(),
	project_id: z.number().nullable(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	time_spent: z.number(),
	todos: z.array(TodoResponseSchema)
});

// --- Composite schemas ---

export const ProjectChildNodeSchema = z.object({
	id: z.number(),
	type: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	time_spent: z.number(),
	parent_id: z.number().nullable().optional(),
	project_id: z.number().nullable().optional(),
	todos: z.array(TodoResponseSchema).optional()
});

export const ProjectChildrenResponseSchema = z.object({
	project: ProjectDetailResponseSchema,
	children: z.array(ProjectChildNodeSchema)
});

export const TaskTimeEntriesResponseSchema = z.object({
	task: TaskDetailResponseSchema,
	time_entries: z.array(TimeEntryResponseSchema)
});

import type { ActiveTreeNode } from '../types/Task.types';

export const ActiveTreeNodeSchema: z.ZodType<ActiveTreeNode> = z.lazy(() =>
	z.object({
		id: z.number(),
		type: z.string(),
		name: z.string(),
		description: z.string().nullable().optional(),
		due_at: z.string().nullable().optional(),
		started_at: z.string().nullable().optional(),
		children: z.array(ActiveTreeNodeSchema).optional()
	})
);

// --- Summary schemas ---

export const TimeEntrySummaryResponseSchema = z.object({
	today: z.number(),
	week: z.number()
});

// --- Query schemas ---

export const TaskByDueDateResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	due_at: z.string().nullable(),
	started_at: z.string().nullable(),
	time_spent: z.number(),
	project_id: z.number().nullable(),
	project_name: z.string().nullable(),
	project_due_at: z.string().nullable()
});

export const TaskByDueDateResponseListSchema = z.array(TaskByDueDateResponseSchema);

// --- History schemas ---

export const TimeEntryHistoryResponseSchema = z.object({
	start_at: z.string(),
	end_at: z.string(),
	data: z.array(z.object({ date: z.string(), value: z.number() }))
});

// --- List schemas ---

export const ProjectResponseListSchema = z.array(ProjectResponseSchema);
export const ActiveTreeNodeListSchema = z.array(ActiveTreeNodeSchema);
