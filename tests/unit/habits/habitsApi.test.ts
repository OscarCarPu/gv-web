import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/shared/api/client', () => ({
	fetchAPI: vi.fn()
}));

import { fetchAPI } from '$lib/shared/api/client';
import { habitsApi } from '$lib/domains/habits/api/habits.api';

const mockFetchAPI = vi.mocked(fetchAPI);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('habitsApi', () => {
	it('getHabits appends date query param', async () => {
		mockFetchAPI.mockResolvedValue([]);
		await habitsApi.getHabits('2026-03-16', 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/habits?date=2026-03-16', expect.anything(), { token: 'tok' });
	});

	it('getHabits without date', async () => {
		mockFetchAPI.mockResolvedValue([]);
		await habitsApi.getHabits(undefined, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/habits', expect.anything(), { token: 'tok' });
	});

	it('createHabit sends POST', async () => {
		mockFetchAPI.mockResolvedValue({ id: 1, name: 'Read', description: null });
		await habitsApi.createHabit({ name: 'Read' }, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/habits', expect.anything(), {
			method: 'POST',
			body: '{"name":"Read"}',
			token: 'tok'
		});
	});

	it('deleteHabit sends DELETE', async () => {
		mockFetchAPI.mockResolvedValue(undefined);
		await habitsApi.deleteHabit(1, 'tok');
		expect(mockFetchAPI).toHaveBeenCalledWith('/habits/1', expect.anything(), {
			method: 'DELETE',
			token: 'tok'
		});
	});
});
