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
  is_required: boolean;
  color: string;
  icon: string;
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
  is_required?: boolean;
  color?: string;
  icon?: string;
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
  is_required?: boolean;
  color?: string;
  icon?: string;
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

export interface HabitTodayStats {
  id: number;
  name: string;
  value_type: ValueType;
  unit: string | null;
  frequency: TargetFrequency;
  target_value: string | null;
  comparison_type: ComparisonType | null;
  is_required: boolean;
  color: string;
  icon: string;
  current_streak: number;
  longest_streak: number;
  average_value: string | null;
  average_completion_rate: string;
  current_period_value: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HistoryPeriod {
  period_start: string;
  period_end: string;
  total_value: string;
}

export interface HabitHistory {
  habit_id: number;
  time_period: string;
  periods: HistoryPeriod[];
}
