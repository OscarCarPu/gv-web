import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Overview, WindowsReport } from '$lib/domains/domotics/uptime/api/uptime.schemas';

// The controller's own work is the timeline: turning the API's windows into positioned
// segments, and picking out the outages. Everything else it holds is state the API produced.

const overview: Overview = {
	computed_at: '2026-08-20T10:00:00Z',
	stale: false,
	stale_after_seconds: 7200,
	devices: [
		{
			device: 'lab',
			state: 'up',
			since: '2026-08-20T06:00:00Z',
			ranges: [
				{
					range: 'month',
					uptime: 98.92,
					range_start: '2026-07-20T10:00:00Z',
					range_end: '2026-08-20T10:00:00Z',
				},
			],
		},
		{ device: 'watchdog', state: 'unknown', since: null, ranges: [] },
	],
};

// A 10-hour range: up for the first 4h, down for 1h, then open for the last 5h.
const report: WindowsReport = {
	from: '2026-08-20T00:00:00Z',
	to: '2026-08-20T10:00:00Z',
	devices: [
		{
			device: 'lab',
			uptime: 90,
			up_seconds: 9 * 3600,
			down_seconds: 3600,
			outages: 1,
			covered_from: '2026-08-20T00:00:00Z',
			covered_to: '2026-08-20T10:00:00Z',
			windows: [
				{
					state: 'up',
					start_time: '2026-08-20T05:00:00Z',
					end_time: null,
					seconds: 5 * 3600,
				},
				{
					state: 'down',
					start_time: '2026-08-20T04:00:00Z',
					end_time: '2026-08-20T05:00:00Z',
					seconds: 3600,
				},
				{
					// Starts before the range: the API's clipped `seconds` is what positions it.
					state: 'up',
					start_time: '2026-08-19T20:00:00Z',
					end_time: '2026-08-20T04:00:00Z',
					seconds: 4 * 3600,
				},
			],
			truncated: false,
		},
	],
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

	it('builds left-to-right segments from the clipped windows', () => {
		const controller = new UptimeController(overview, report);
		const segments = controller.segmentsFor('lab');

		// Oldest first, whatever order the API listed them in.
		expect(segments.map((s) => s.state)).toEqual(['up', 'down', 'up']);
		// The window starting before the range is anchored at 0 and only its overlap counts.
		expect(segments[0]).toMatchObject({ left: 0, width: 40 });
		expect(segments[1]).toMatchObject({ left: 40, width: 10 });
		// The open window runs to the end of the range.
		expect(segments[2]).toMatchObject({ left: 50, width: 50 });
	});

	it('renders a range with no windows as one unknown segment', () => {
		const controller = new UptimeController(overview, report);
		expect(controller.segmentsFor('watchdog')).toEqual([
			{ state: 'unknown', left: 0, width: 100, label: 'no data' },
		]);
	});

	it('has nothing to draw without a report', () => {
		expect(new UptimeController(overview, null).segmentsFor('lab')).toEqual([]);
	});

	it('lists only the down windows as outages', () => {
		const outages = new UptimeController(overview, report).outagesFor('lab');
		expect(outages).toHaveLength(1);
		expect(outages[0].start_time).toBe('2026-08-20T04:00:00Z');
	});

	it('treats a missing overview as stale: there is no run to call fresh', () => {
		expect(new UptimeController(null, null).stale).toBe(true);
		expect(new UptimeController(overview, report).stale).toBe(false);
	});

	it('asks for a from and leaves to to the API, which clamps it to now', () => {
		expect(rangeFor('24h')).toEqual({ from: '2026-08-19T10:00:00.000Z' });
		expect(rangeFor('7d')).toEqual({ from: '2026-08-13T10:00:00.000Z' });
	});
});
