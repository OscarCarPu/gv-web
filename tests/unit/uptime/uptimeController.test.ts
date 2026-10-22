import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Overview, WindowsReport } from '$lib/domains/domotics/uptime/api/uptime.schemas';

const overview: Overview = {
	up_since: '2026-08-20T06:00:00Z',
	ranges: [
		{
			range: 'month',
			uptime: 98.92,
			up_seconds: 2500000,
			down_seconds: 900,
			failover_seconds: 6100,
			range_start: '2026-07-20T10:00:00Z',
			range_end: '2026-08-20T10:00:00Z',
		},
	],
};

const report: WindowsReport = {
	from: '2026-08-20T00:00:00Z',
	to: '2026-08-20T10:00:00Z',
	uptime: 90,
	up_seconds: 7 * 3600,
	down_seconds: 3600,
	failover_seconds: 2 * 3600,
	outages: 1,
	windows: [
		{
			kind: 'up',
			start_time: '2026-08-20T07:00:00Z',
			end_time: '2026-08-20T10:00:00Z',
			seconds: 3 * 3600,
		},
		{
			kind: 'failover',
			start_time: '2026-08-20T05:00:00Z',
			end_time: '2026-08-20T07:00:00Z',
			seconds: 2 * 3600,
		},
		{
			kind: 'down',
			start_time: '2026-08-20T04:00:00Z',
			end_time: '2026-08-20T05:00:00Z',
			seconds: 3600,
		},
		{
			kind: 'up',
			start_time: '2026-08-19T20:00:00Z',
			end_time: '2026-08-20T04:00:00Z',
			seconds: 4 * 3600,
		},
	],
	truncated: false,
};

describe('UptimeController', () => {
	let UptimeController: typeof import('$lib/domains/domotics/uptime/uptime.svelte').UptimeController;
	let rangeFor: typeof import('$lib/domains/domotics/uptime/uptime.svelte').rangeFor;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-20T10:00:00Z'));
		const module = await import('$lib/domains/domotics/uptime/uptime.svelte');
		UptimeController = module.UptimeController;
		rangeFor = module.rangeFor;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('builds left-to-right segments from the clipped windows, failover included', () => {
		const segments = new UptimeController(overview, report).segments;

		expect(segments.map((s) => s.kind)).toEqual(['up', 'down', 'failover', 'up']);
		expect(segments[0]).toMatchObject({ left: 0, width: 40 });
		expect(segments[1]).toMatchObject({ left: 40, width: 10 });
		expect(segments[2]).toMatchObject({ left: 50, width: 20 });
		expect(segments[3]).toMatchObject({ left: 70, width: 30 });
	});

	it('renders a range with no windows as one unknown segment', () => {
		const controller = new UptimeController(overview, { ...report, windows: [] });
		expect(controller.segments).toEqual([
			{ kind: 'unknown', left: 0, width: 100, label: 'no data' },
		]);
	});

	it('has nothing to draw without a report or with an empty range', () => {
		expect(new UptimeController(overview, null).segments).toEqual([]);
		expect(new UptimeController(overview, { ...report, to: report.from }).segments).toEqual([]);
	});

	it('lists only the down windows as outages', () => {
		const outages = new UptimeController(overview, report).outages;
		expect(outages).toHaveLength(1);
		expect(outages[0].start_time).toBe('2026-08-20T04:00:00Z');
	});

	it('shows at most five outages, newest first', () => {
		const many = {
			...report,
			windows: Array.from({ length: 8 }, (_, i) => ({
				kind: 'down' as const,
				start_time: `2026-08-20T0${i}:00:00Z`,
				end_time: `2026-08-20T0${i}:30:00Z`,
				seconds: 1800,
			})),
		};
		const outages = new UptimeController(overview, many).outages;
		expect(outages).toHaveLength(5);
		expect(outages[0].start_time).toBe('2026-08-20T00:00:00Z');
	});

	it('asks for a from and leaves to to the API, which clamps it to now', () => {
		expect(rangeFor('24h')).toEqual({ from: '2026-08-19T10:00:00.000Z' });
		expect(rangeFor('7d')).toEqual({ from: '2026-08-13T10:00:00.000Z' });
	});
});
