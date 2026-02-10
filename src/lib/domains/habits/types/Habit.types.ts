export interface HabitWithLog {
  id: number;
  name: string;
  description: string | null;
  log_value: number | null;
}

export interface CreateHabitRequest {
  name: string;
  description?: string | null;
}

export interface LogUpsertRequest {
  habit_id: number;
  date: string;
  value: number;
}
