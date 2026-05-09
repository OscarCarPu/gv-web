export interface HabitWithLog {
	id: number;
	name: string;
	description: string | null;
	log_value: number | null;
	frequency: string;
	target_min: number | null;
	target_max: number | null;
	recording_required: boolean;
	period_value: number;
	current_streak: number;
	longest_streak: number;
}

export interface CreateHabitRequest {
	name: string;
	description?: string | null;
	frequency?: string;
	target_min?: number | null;
	target_max?: number | null;
	recording_required?: boolean;
}

export interface UpdateHabitRequest {
	name: string;
	description: string | null;
	frequency: string;
	target_min: number | null;
	target_max: number | null;
	recording_required: boolean;
}

export interface LogUpsertRequest {
	habit_id: number;
	date: string;
	value: number;
}

export interface HabitHistoryEntry {
	date: string;
	value: number;
}

export interface HabitHistoryResponse {
	start_at: string;
	end_at: string;
	data: HabitHistoryEntry[];
}
