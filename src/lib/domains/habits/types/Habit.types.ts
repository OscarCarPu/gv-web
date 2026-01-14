export type ValueType = 'boolean' | 'numeric';
export type TargetFrequency = 'daily' | 'weekly' | 'monthly';
export type ComparisonType =
  | 'equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal_than'
  | 'less_equal_than'
  | 'in_range';

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  value_type: ValueType;
  unit: string | null;
  frequency: TargetFrequency;
  target_value: string | null;
  target_min: string | null;
  target_max: string | null;
  comparison_type: ComparisonType | null;
  start_date: string | null;
  end_date: string | null;
  default_value: number | null;
  streak_strict: boolean;
  icon: string;
  big_step: string | null;
  small_step: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  value_type: ValueType;
  unit?: string | null;
  frequency?: TargetFrequency;
  target_value?: string | null;
  target_min?: string | null;
  target_max?: string | null;
  comparison_type?: ComparisonType | null;
  start_date?: string | null;
  end_date?: string | null;
  default_value?: number | null;
  streak_strict?: boolean;
  icon?: string;
  big_step?: string | null;
  small_step?: string | null;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  value_type?: ValueType;
  unit?: string | null;
  frequency?: TargetFrequency;
  target_value?: string | null;
  target_min?: string | null;
  target_max?: string | null;
  comparison_type?: ComparisonType | null;
  start_date?: string | null;
  end_date?: string | null;
  default_value?: number | null;
  streak_strict?: boolean;
  icon?: string;
  big_step?: string | null;
  small_step?: string | null;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLogInput {
  log_date: string;
  value: string;
}

export interface UpdateLogInput {
  log_date?: string;
  value?: string;
}

export interface HabitDayStats {
  id: number;
  name: string;
  value_type: ValueType;
  unit: string | null;
  frequency: TargetFrequency;
  target_value: number | null;
  target_min: number | null;
  target_max: number | null;
  comparison_type: ComparisonType | null;
  description: string | null;
  default_value: number | null;
  streak_strict: boolean;
  icon: string;
  current_streak: number;
  longest_streak: number;
  average_value: number | null;
  average_completion_rate: number | null;
  current_period_value: number | null;
  date_value: number | null;
  small_step: number | null;
  big_step: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
