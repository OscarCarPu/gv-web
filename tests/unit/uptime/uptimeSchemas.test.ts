import { describe, it, expect } from 'vitest';
import {
	OverviewSchema,
	WindowSchema,
	WindowsReportSchema,
} from '$lib/domains/domotics/uptime/api/uptime.schemas';

const range = {
	range: 'month',
	uptime: 99.9,
	up_seconds: 100,
	down_seconds: 1,
	failover_seconds: 2,
	range_start: '2026-08-01T00:00:00Z',
	range_end: '2026-08-31T00:00:00Z',
};

describe('OverviewSchema', () => {
	it('parses the four-lookback overview', () => {
		const parsed = OverviewSchema.parse({
			up_since: '2026-08-13T16:54:25Z',
			ranges: [range, { ...range, range: 'all' }],
		});
		expect(parsed.ranges).toHaveLength(2);
	});

	it('accepts a null percentage and turns null ranges into an empty list', () => {
		expect(
			OverviewSchema.parse({ up_since: 'x', ranges: [{ ...range, uptime: null }] }).ranges[0].uptime
		).toBeNull();
		expect(OverviewSchema.parse({ up_since: 'x', ranges: null }).ranges).toEqual([]);
	});

	it('rejects a lookback that is not one of the four', () => {
		expect(() =>
			OverviewSchema.parse({ up_since: 'x', ranges: [{ ...range, range: 'week' }] })
		).toThrow();
	});
});

describe('WindowSchema', () => {
	const window = { kind: 'failover', start_time: 'a', end_time: 'b', seconds: 1 };

	it('knows the three kinds', () => {
		for (const kind of ['up', 'down', 'failover']) {
			expect(WindowSchema.parse({ ...window, kind }).kind).toBe(kind);
		}
	});

	it('rejects an unknown kind and a window without an end', () => {
		expect(() => WindowSchema.parse({ ...window, kind: 'unknown' })).toThrow();
		expect(() => WindowSchema.parse({ ...window, end_time: null })).toThrow();
	});
});

describe('WindowsReportSchema', () => {
	it('keeps null uptime distinct from zero and turns null windows into an empty list', () => {
		const parsed = WindowsReportSchema.parse({
			from: 'a',
			to: 'b',
			uptime: null,
			up_seconds: 0,
			down_seconds: 0,
			failover_seconds: 0,
			outages: 0,
			windows: null,
			truncated: false,
		});
		expect(parsed.uptime).toBeNull();
		expect(parsed.windows).toEqual([]);
	});
});
