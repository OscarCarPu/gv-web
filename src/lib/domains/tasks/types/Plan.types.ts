import type { TimeEntrySummaryResponse } from './Task.types';

export interface PlanBlockResponse {
	id: number;
	plan_date: string;
	started_at: string;
	ended_at: string;
	task_id: number | null;
	task_name: string | null;
	label: string;
	note: string | null;
	event_ref: string | null;
	commitment_id: number | null;
	task_type?: string | null;
	task_recurrence?: number | null;
	task_started_at?: string | null;
	task_finished_at?: string | null;
}

export interface PlanRangeResponse {
	from: string;
	to: string;
	blocks: PlanBlockResponse[];
}

export interface RecurringCommitmentResponse {
	id: number;
	task_id: number;
	task_name: string;
	label: string;
	days_of_week: number[];
	start_time: string;
	end_time: string;
	active: boolean;
}

export interface CreateCommitmentRequest {
	task_id: number;
	label: string;
	days_of_week: number[];
	start_time: string;
	end_time: string;
}

export interface UpdateCommitmentRequest {
	label?: string;
	days_of_week?: number[];
	start_time?: string;
	end_time?: string;
	active?: boolean;
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
	event_ref?: string | null;
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
