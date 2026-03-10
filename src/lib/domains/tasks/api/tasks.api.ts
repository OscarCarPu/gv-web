import { fetchAPI } from '$lib/shared/api/client';
import {
	ProjectResponseSchema,
	ProjectResponseListSchema,
	ProjectChildrenResponseSchema,
	TaskResponseSchema,
	TaskTimeEntriesResponseSchema,
	TodoResponseSchema,
	TimeEntryResponseSchema,
	ActiveTreeNodeListSchema,
	TaskByDueDateResponseListSchema
} from './tasks.schemas';
import type {
	ProjectResponse,
	ProjectChildrenResponse,
	CreateProjectRequest,
	UpdateProjectRequest,
	TaskResponse,
	TaskTimeEntriesResponse,
	CreateTaskRequest,
	UpdateTaskRequest,
	TodoResponse,
	CreateTodoRequest,
	UpdateTodoRequest,
	TimeEntryResponse,
	CreateTimeEntryRequest,
	UpdateTimeEntryRequest,
	ActiveTreeNode,
	TaskByDueDateResponse
} from '../types/Task.types';

export const tasksApi = {
	// --- Projects ---

	async getRootProjects(token?: string): Promise<ProjectResponse[]> {
		return fetchAPI('/tasks/projects', ProjectResponseListSchema, { token });
	},

	async getProjectChildren(id: number, token?: string): Promise<ProjectChildrenResponse> {
		return fetchAPI(`/tasks/projects/${id}/children`, ProjectChildrenResponseSchema, { token });
	},

	async createProject(input: CreateProjectRequest, token?: string): Promise<ProjectResponse> {
		return fetchAPI('/tasks/projects', ProjectResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token
		});
	},

	async updateProject(id: number, input: UpdateProjectRequest, token?: string): Promise<ProjectResponse> {
		return fetchAPI(`/tasks/projects/${id}`, ProjectResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token
		});
	},

	// --- Tasks ---

	async createTask(input: CreateTaskRequest, token?: string): Promise<TaskResponse> {
		return fetchAPI('/tasks/tasks', TaskResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token
		});
	},

	async updateTask(id: number, input: UpdateTaskRequest, token?: string): Promise<TaskResponse> {
		return fetchAPI(`/tasks/tasks/${id}`, TaskResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token
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
			token
		});
	},

	async updateTodo(id: number, input: UpdateTodoRequest, token?: string): Promise<TodoResponse> {
		return fetchAPI(`/tasks/todos/${id}`, TodoResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token
		});
	},

	// --- Time Entries ---

	async createTimeEntry(input: CreateTimeEntryRequest, token?: string): Promise<TimeEntryResponse> {
		return fetchAPI('/tasks/time-entries', TimeEntryResponseSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token
		});
	},

	async updateTimeEntry(id: number, input: UpdateTimeEntryRequest, token?: string): Promise<TimeEntryResponse> {
		return fetchAPI(`/tasks/time-entries/${id}`, TimeEntryResponseSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token
		});
	},

	// --- Tree ---

	async getActiveTree(token?: string): Promise<ActiveTreeNode[]> {
		return fetchAPI('/tasks/tree', ActiveTreeNodeListSchema, { token });
	}
};
