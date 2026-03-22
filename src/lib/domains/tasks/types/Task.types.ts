export interface ProjectListItem {
    id: number;
    name: string;
}

export interface CreateProjectRequest {
    name: string;
    description?: string | null;
    due_at?: string | null;
    parent_id?: number | null;
}

export interface ProjectResponse {
    id: number;
    name: string;
    description: string | null;
    due_at: string | null;
    parent_id: number | null;
    started_at: string | null;
    finished_at: string | null;
}

export interface CreateTaskRequest {
    project_id?: number | null;
    name: string;
    description?: string | null;
    due_at?: string | null;
}

export interface TaskResponse {
    id: number;
    project_id: number | null;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    finished_at: string | null;
}

export interface CreateTodoRequest {
    task_id: number;
    name: string;
}

export interface TodoResponse {
    id: number;
    task_id: number;
    name: string;
    is_done: boolean;
}

export interface CreateTimeEntryRequest {
    task_id: number;
    started_at: string;
    finished_at?: string | null;
    comment?: string | null;
}

export interface TimeEntryResponse {
    id: number;
    task_id: number;
    started_at: string;
    finished_at: string | null;
    comment: string | null;
}

export interface UpdateProjectRequest {
    name?: string | null;
    description?: string | null;
    due_at?: string | null;
    parent_id?: number | null;
    started_at?: string | null;
    finished_at?: string | null;
}

export interface UpdateTaskRequest {
    name?: string | null;
    description?: string | null;
    due_at?: string | null;
    project_id?: number | null;
    started_at?: string | null;
    finished_at?: string | null;
}

export interface UpdateTodoRequest {
    name?: string | null;
    is_done?: boolean | null;
}

export interface UpdateTimeEntryRequest {
    task_id?: number | null;
    started_at?: string | null;
    finished_at?: string | null;
    comment?: string | null;
}

export interface TaskByDueDateResponse {
    id: number;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    time_spent: number;
    project_id: number | null;
    project_name: string | null;
    project_due_at: string | null;
}

export interface TaskDetailResponse {
    id: number;
    project_id: number | null;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    time_spent: number;
}

export interface TaskFullResponse {
    id: number;
    project_id: number | null;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    time_spent: number;
    todos: TodoResponse[];
}

export interface TaskTimeEntriesResponse {
    task: TaskDetailResponse;
    time_entries: TimeEntryResponse[];
}

export interface ProjectDetailResponse {
    id: number;
    parent_id: number | null;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    time_spent: number;
}

export interface ProjectChildNode {
    id: number;
    type: string;
    name: string;
    description: string | null;
    due_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    time_spent: number;
    parent_id?: number | null; // project only
    project_id?: number | null; // task only
    todos?: TodoResponse[]; //task only
}

export interface ProjectChildrenResponse {
    project: ProjectDetailResponse;
    children: ProjectChildNode[];
}

export interface TimeEntrySummaryResponse {
    today: number;
    week: number;
}

export interface ActiveTreeNode {
    id: number;
    type: string;
    name: string;
    description?: string | null;
    due_at?: string | null;
    started_at?: string | null;
    children?: ActiveTreeNode[];
}

export interface TimeEntryHistoryEntry {
    date: string;
    value: number;
}

export interface TimeEntryHistoryResponse {
    start_at: string;
    end_at: string;
    data: TimeEntryHistoryEntry[];
}
