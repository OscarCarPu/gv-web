import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as z from 'zod';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/config/env', () => ({
	env: { API_URL: 'http://test-api', SERVER_API_URL: 'http://test-api' },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { ApiError, fetchAPI, isMergePending } from '$lib/shared/api/client';

const assign = vi.fn();

function locked() {
	mockFetch.mockResolvedValue({
		ok: false,
		status: 503,
		statusText: 'Service Unavailable',
		json: () => Promise.resolve({ error: 'Restoring data', code: 'merge_pending' }),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('merge_pending', () => {
	it('is recognised by its code', () => {
		expect(isMergePending(new ApiError('x', 503, 'merge_pending'))).toBe(true);
		expect(isMergePending(new ApiError('x', 503, 'unavailable_on_failover'))).toBe(false);
		expect(isMergePending(new Error('x'))).toBe(false);
	});

	it('sends the browser to the report page and still throws', async () => {
		vi.stubGlobal('location', { pathname: '/tasks', assign });
		locked();

		await expect(fetchAPI('/habits', z.unknown())).rejects.toMatchObject({ code: 'merge_pending' });

		expect(assign).toHaveBeenCalledWith('/report');
	});

	it('does not redirect from the report page itself', async () => {
		vi.stubGlobal('location', { pathname: '/report', assign });
		locked();

		await expect(fetchAPI('/report', z.unknown())).rejects.toBeInstanceOf(ApiError);

		expect(assign).not.toHaveBeenCalled();
	});
});
