import type { TimeEntrySummaryResponse } from './Task.types';

export interface PlanBlockResponse {
	id: number;
	started_at: string;
	ended_at: string;
	task_id: number | null;
	task_name: string | null;
	label: string;
	note: string | null;
	task_type?: string | null;
	task_recurrence?: number | null;
	task_started_at?: string | null;
	task_finished_at?: string | null;
}

export interface PlanTotals {
	task_seconds: number;
	free_seconds: number;
}

export interface PlanTodayResponse {
	date: string;
	blocks: PlanBlockResponse[];
	totals: PlanTotals;
	budget: TimeEntrySummaryResponse;
}

export interface CreatePlanBlockRequest {
	started_at: string;
	ended_at: string;
	task_id?: number | null;
	label?: string | null;
	note?: string | null;
}

export interface UpdatePlanBlockRequest {
	started_at?: string;
	ended_at?: string;
	task_id?: number | null;
	clear_task?: boolean;
	label?: string;
	note?: string;
	clear_note?: boolean;
}
