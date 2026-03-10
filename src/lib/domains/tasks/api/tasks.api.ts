import { z } from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	ProjectResponseSchema,
	ProjectResponseListSchema,
	ProjectDetailResponseSchema,
	ProjectChildrenResponseSchema,
	TaskResponseSchema,
	TaskFullResponseSchema,
	TaskTimeEntriesResponseSchema,
	TodoResponseSchema,
	TimeEntryResponseSchema,
	ActiveTreeNodeListSchema,
	TaskByDueDateResponseListSchema
} from './tasks.schemas';
import type {
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

	async deleteProject(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/projects/${id}`, z.void(), {
			method: 'DELETE',
			token
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

	async deleteTask(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/tasks/${id}`, z.void(), {
			method: 'DELETE',
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

	async deleteTodo(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/todos/${id}`, z.void(), {
			method: 'DELETE',
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

	async deleteTimeEntry(id: number, token?: string): Promise<void> {
		return fetchAPI(`/tasks/time-entries/${id}`, z.void(), {
			method: 'DELETE',
			token
		});
	},

	// --- Tree ---

	async getActiveTree(token?: string): Promise<ActiveTreeNode[]> {
		return fetchAPI('/tasks/tree', ActiveTreeNodeListSchema, { token });
	}
};
