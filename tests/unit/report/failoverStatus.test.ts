import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));
vi.mock('$lib/config/env', () => ({
	env: { API_URL: 'http://test-api', SERVER_API_URL: 'http://test-api' },
}));

import { createFailoverStatus } from '$lib/server/failoverStatus';
import type { ReportStatus } from '$lib/domains/report/api/report.schemas';

const withItems: ReportStatus['report'] = {
	items: [
		{ table: 't', key: '[1]', op: 'insert', base: null, home: { id: 1 }, ec2: null, related: {} },
	],
	skipped: [],
};

function setup(answer: () => Promise<Partial<ReportStatus>>) {
	let time = 1_000;
	const fetchStatus = vi.fn(
		async () => ({ merge: '', report: null, ...(await answer()) }) as ReportStatus
	);
	return {
		status: createFailoverStatus(fetchStatus, () => time),
		fetchStatus,
		advance: (ms: number) => (time += ms),
	};
}

describe('failoverStatus', () => {
	it('asks once per interval while the app is not held', async () => {
		const s = setup(() => Promise.resolve({ mode: 'normal' }));

		expect(await s.status('t')).toEqual({ locked: false, report: false });
		await s.status('t');
		await s.status('t');
		expect(s.fetchStatus).toHaveBeenCalledTimes(1);

		s.advance(5_001);
		await s.status('t');
		expect(s.fetchStatus).toHaveBeenCalledTimes(2);
	});

	it('never remembers a hold, so the app opens as soon as it ends', async () => {
		let mode: ReportStatus['mode'] = 'hold';
		const s = setup(() => Promise.resolve({ mode }));

		expect((await s.status('t')).locked).toBe(true);
		expect((await s.status('t')).locked).toBe(true);
		expect(s.fetchStatus).toHaveBeenCalledTimes(2);

		mode = 'normal';
		expect((await s.status('t')).locked).toBe(false);
	});

	it('holds in merge mode too', async () => {
		const s = setup(() => Promise.resolve({ mode: 'merge' }));
		expect((await s.status('t')).locked).toBe(true);
	});

	it('says when a report is waiting, and remembers it for the interval', async () => {
		const s = setup(() => Promise.resolve({ mode: 'normal', report: withItems }));

		expect(await s.status('t')).toEqual({ locked: false, report: true });
		expect(await s.status('t')).toEqual({ locked: false, report: true });
		expect(s.fetchStatus).toHaveBeenCalledTimes(1);
	});

	it('treats an unreachable or missing answer as not held, and does not hammer it', async () => {
		const s = setup(() => Promise.reject(new Error('404')));

		expect(await s.status('t')).toEqual({ locked: false, report: false });
		await s.status('t');
		expect(s.fetchStatus).toHaveBeenCalledTimes(1);
	});

	it('passes the token on', async () => {
		const s = setup(() => Promise.resolve({ mode: 'normal' }));
		await s.status('abc');
		expect(s.fetchStatus).toHaveBeenCalledWith('abc');
	});
});
