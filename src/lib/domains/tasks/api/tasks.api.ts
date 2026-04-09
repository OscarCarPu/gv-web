import { z } from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	ProjectResponseSchema,
	ProjectResponseListSchema,
	ProjectListItemListSchema,
	ProjectDetailResponseSchema,
	ProjectChildrenResponseSchema,
	TaskResponseSchema,
	TaskFullResponseSchema,
	TaskTimeEntriesResponseSchema,
	TodoResponseSchema,
	TimeEntryResponseSchema,
	ActiveTimeEntryResponseSchema,
	ActiveTreeNodeListSchema,
	TaskByDueDateResponseListSchema,
	TimeEntrySummaryResponseSchema,
	TimeEntryHistoryResponseSchema,
	TimeEntryWithTaskListSchema,
	TaskListItemListSchema,
} from './tasks.schemas';
import type {
	ProjectListItem,
	ProjectResponse,
	ProjectDetailResponse,
	ProjectChildrenResponse,
	CreateProjectRequest,
	UpdateProjectRequest,
	TaskResponse,
	TaskFullResponse,
	TaskTimeEntriesResponse,
	CreateTaskRequest,
	UpdateTaskRequest,
	TodoResponse,
	CreateTodoRequest,
	UpdateTodoRequest,
	TimeEntryResponse,
	ActiveTimeEntryResponse,
	CreateTimeEntryRequest,
	UpdateTimeEntryRequest,
	ActiveTreeNode,
	TaskByDueDateResponse,
	TaskListItem,
	TimeEntrySummaryResponse,
	TimeEntryHistoryResponse,
	TimeEntryWithTask,
} from '../types/Task.types';

export const tasksApi = {
	// --- Projects ---

	async listProjectsFast(token?: string): Promise<ProjectListItem[]> {
		return fetchAPI('/tasks/projects/list-fast', ProjectListItemListSchema, { token });
	},

	async listTasksFast(token?: string): Promise<TaskListItem[]> {
		return fetchAPI('/tasks/tasks/list-fast', TaskListItemListSchema, { token });
	},

	async getRootProjects(token?: string): Promise<ProjectResponse[]> {
		return fetchAPI('/tasks/projects', ProjectResponseListSchema, { token });
	},

	async getProject(id: number, token?: string): Promise<ProjectDetailResponse> {
		return fetchAPI(`/tasks/projects/${id}`, ProjectDetailResponseSchema, { token });
	},

	async getProjectChildren(id: number, token?: string): Promise<ProjectChildrenResponse> {
		return fetchAPI(`/tasks/projects/${id}/children`, ProjectChildrenResponseSchema, { token });
	},

	async createProject(input: CreateProjectRequest, token?: string): Promise<ProjectResponse> {
		return fetchAPI('/tasks/projects', ProjectResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateProject(
		id: number,
		input: UpdateProjectRequest,
		token?: string
	): Promise<ProjectResponse> {
		return fetchAPI(`/tasks/projects/${id}`, ProjectResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteProject(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/projects/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Tasks ---

	async getTask(id: number, token?: string): Promise<TaskFullResponse> {
		return fetchAPI(`/tasks/tasks/${id}`, TaskFullResponseSchema, { token });
	},

	async createTask(input: CreateTaskRequest, token?: string): Promise<TaskResponse> {
		return fetchAPI('/tasks/tasks', TaskResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateTask(id: number, input: UpdateTaskRequest, token?: string): Promise<TaskResponse> {
		return fetchAPI(`/tasks/tasks/${id}`, TaskResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteTask(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/tasks/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	async getTaskTimeEntries(id: number, token?: string): Promise<TaskTimeEntriesResponse> {
		return fetchAPI(`/tasks/tasks/${id}/time-entries`, TaskTimeEntriesResponseSchema, { token });
	},

	async getTasksByDueDate(token?: string): Promise<TaskByDueDateResponse[]> {
		return fetchAPI('/tasks/tasks/by-due-date', TaskByDueDateResponseListSchema, { token });
	},

	// --- Todos ---

	async createTodo(input: CreateTodoRequest, token?: string): Promise<TodoResponse> {
		return fetchAPI('/tasks/todos', TodoResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateTodo(id: number, input: UpdateTodoRequest, token?: string): Promise<TodoResponse> {
		return fetchAPI(`/tasks/todos/${id}`, TodoResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteTodo(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/todos/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Time Entries ---

	async createTimeEntry(input: CreateTimeEntryRequest, token?: string): Promise<TimeEntryResponse> {
		return fetchAPI('/tasks/time-entries', TimeEntryResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateTimeEntry(
		id: number,
		input: UpdateTimeEntryRequest,
		token?: string
	): Promise<TimeEntryResponse> {
		return fetchAPI(`/tasks/time-entries/${id}`, TimeEntryResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async getActiveTimeEntry(token?: string): Promise<ActiveTimeEntryResponse> {
		return fetchAPI('/tasks/time-entries/active', ActiveTimeEntryResponseSchema, { token });
	},

	async deleteTimeEntry(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/time-entries/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Summary ---

	async getTimeEntrySummary(token?: string): Promise<TimeEntrySummaryResponse> {
		return fetchAPI('/tasks/time-entries/summary', TimeEntrySummaryResponseSchema, { token });
	},

	async getTimeEntryHistory(
		params: { frequency: string; start_at?: string; end_at?: string },
		token?: string
	): Promise<TimeEntryHistoryResponse> {
		const query = new URLSearchParams();
		query.set('frequency', params.frequency);
		if (params.start_at) query.set('start_at', params.start_at);
		if (params.end_at) query.set('end_at', params.end_at);
		return fetchAPI(`/tasks/time-entries/history?${query}`, TimeEntryHistoryResponseSchema, {
			token,
		});
	},

	async getTimeEntries(
		params: { start_time: string; end_time?: string },
		token?: string
	): Promise<TimeEntryWithTask[]> {
		const query = new URLSearchParams();
		query.set('start_time', params.start_time);
		if (params.end_time) query.set('end_time', params.end_time);
		return fetchAPI(`/tasks/time-entries?${query}`, TimeEntryWithTaskListSchema, { token });
	},

	// --- Tree ---

	async getActiveTree(token?: string): Promise<ActiveTreeNode[]> {
		return fetchAPI('/tasks/tree', ActiveTreeNodeListSchema, { token });
	},
};
