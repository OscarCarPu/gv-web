import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/shared/api/client', () => ({
	fetchAPI: vi.fn(),
}));

import { fetchAPI } from '$lib/shared/api/client';
import { tasksApi } from '$lib/domains/tasks/api/tasks.api';

const mockFetchAPI = vi.mocked(fetchAPI);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('tasksApi', () => {
	it('getRootProjects calls correct endpoint', async () => {
		mockFetchAPI.mockResolvedValue([]);
		await tasksApi.getRootProjects('tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/tasks/projects', expect.anything(), {
			token: 'tok',
		});
	});

	it('createTask sends POST with body', async () => {
		mockFetchAPI.mockResolvedValue({ id: 1 });
		await tasksApi.createTask({ name: 'T1' }, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/tasks/tasks', expect.anything(), {
			method: 'POST',
			body: '{"name":"T1"}',
			token: 'tok',
		});
	});

	it('deleteTask sends DELETE', async () => {
		mockFetchAPI.mockResolvedValue(undefined);
		await tasksApi.deleteTask(1, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/tasks/tasks/1', expect.anything(), {
			method: 'DELETE',
			token: 'tok',
		});
	});

	it('createTimeEntry sends POST with body', async () => {
		mockFetchAPI.mockResolvedValue({ id: 1 });
		await tasksApi.createTimeEntry({ task_id: 1, started_at: '2026-01-01T00:00:00Z' }, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/tasks/time-entries', expect.anything(), {
			method: 'POST',
			body: '{"task_id":1,"started_at":"2026-01-01T00:00:00Z"}',
			token: 'tok',
		});
	});

	it('getActiveTree calls correct endpoint', async () => {
		mockFetchAPI.mockResolvedValue([]);
		await tasksApi.getActiveTree('tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/tasks/tree', expect.anything(), { token: 'tok' });
	});
});
