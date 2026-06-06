import { describe, it, expect, vi } from 'vitest';
import { deleteWithConflict } from '$lib/domains/money/utils/deleteConflict';

describe('deleteWithConflict', () => {
	it('returns ok when the delete succeeds', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const result = await deleteWithConflict({ run, needles: ['transactions'] });
		expect(result).toEqual({ ok: true, conflict: false });
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('flags a conflict when the error message includes a needle', async () => {
		const run = vi.fn().mockRejectedValue(new Error('account has associated transactions'));
		const result = await deleteWithConflict({ run, needles: ['transactions'] });
		expect(result).toEqual({ ok: false, conflict: true });
	});

	it('matches the "referenced" needle for categories', async () => {
		const run = vi.fn().mockRejectedValue(new Error('category is referenced by another'));
		const result = await deleteWithConflict({ run, needles: ['referenced'] });
		expect(result).toEqual({ ok: false, conflict: true });
	});

	it('returns a generic (non-conflict) failure for other errors', async () => {
		const run = vi.fn().mockRejectedValue(new Error('network down'));
		const result = await deleteWithConflict({ run, needles: ['transactions'] });
		expect(result).toEqual({ ok: false, conflict: false });
	});

	it('treats a non-Error throw as a generic failure', async () => {
		const run = vi.fn().mockRejectedValue('transactions'); // string, not Error → msg = ''
		const result = await deleteWithConflict({ run, needles: ['transactions'] });
		expect(result).toEqual({ ok: false, conflict: false });
	});

	it('matches any of several needles', async () => {
		const run = vi.fn().mockRejectedValue(new Error('still referenced'));
		const result = await deleteWithConflict({ run, needles: ['transactions', 'referenced'] });
		expect(result).toEqual({ ok: false, conflict: true });
	});
});
