import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as z from 'zod';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/config/env', () => ({
	env: { API_URL: 'http://test-api', SERVER_API_URL: 'http://test-api' }
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchAPI, setClientToken } from '$lib/shared/api/client';

const TestSchema = z.object({ id: z.number(), name: z.string() });

beforeEach(() => {
	vi.clearAllMocks();
	setClientToken(undefined);
});

describe('fetchAPI', () => {
	it('makes a GET request and parses response', async () => {
		mockFetch.mockResolvedValue({
			ok: true, status: 200,
			json: () => Promise.resolve({ id: 1, name: 'Test' })
		});

		const result = await fetchAPI('/items', TestSchema);
		expect(mockFetch).toHaveBeenCalledWith('http://test-api/items', expect.objectContaining({
			headers: expect.objectContaining({ 'Content-Type': 'application/json' })
		}));
		expect(result).toEqual({ id: 1, name: 'Test' });
	});

	it('includes Authorization header when token is passed', async () => {
		mockFetch.mockResolvedValue({
			ok: true, status: 200,
			json: () => Promise.resolve({ id: 1, name: 'Test' })
		});

		await fetchAPI('/items', TestSchema, { token: 'my-token' });
		expect(mockFetch).toHaveBeenCalledWith('http://test-api/items', expect.objectContaining({
			headers: expect.objectContaining({ Authorization: 'Bearer my-token' })
		}));
	});

	it('throws on non-ok response', async () => {
		mockFetch.mockResolvedValue({
			ok: false, status: 400, statusText: 'Bad Request',
			json: () => Promise.resolve({ error: 'Invalid input' })
		});

		await expect(fetchAPI('/items', TestSchema)).rejects.toThrow('Invalid input');
	});

	it('returns undefined for 204 responses', async () => {
		mockFetch.mockResolvedValue({ ok: true, status: 204 });

		const result = await fetchAPI('/items/1', z.void(), { method: 'DELETE' });
		expect(result).toBeUndefined();
	});
});
