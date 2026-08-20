import { describe, it, expect } from 'vitest';
import {
	DeviceWindowsSchema,
	OverviewSchema,
	WindowsReportSchema,
} from '$lib/domains/domotics/uptime/api/uptime.schemas';

describe('OverviewSchema', () => {
	it('accepts a device the pipeline has never heard from', () => {
		const parsed = OverviewSchema.parse({
			computed_at: null,
			stale: true,
			stale_after_seconds: 7200,
			devices: [{ device: 'watchdog', state: 'unknown', since: null, ranges: null }],
		});
		expect(parsed.devices[0].ranges).toEqual([]);
		expect(parsed.computed_at).toBeNull();
	});

	it('rejects a device that is not one of the two that exist', () => {
		expect(() =>
			OverviewSchema.parse({
				computed_at: null,
				stale: true,
				stale_after_seconds: 0,
				devices: [{ device: 'printer', state: 'up', since: null, ranges: [] }],
			})
		).toThrow();
	});

	it('turns a null device list into an empty one', () => {
		const parsed = OverviewSchema.parse({
			computed_at: '2026-08-20T10:00:00Z',
			stale: false,
			stale_after_seconds: 7200,
			devices: null,
		});
		expect(parsed.devices).toEqual([]);
	});
});

describe('DeviceWindowsSchema', () => {
	it('keeps null uptime distinct from zero', () => {
		// Null means no window overlapped the range; 0 would mean the device was down for it.
		const parsed = DeviceWindowsSchema.parse({
			device: 'lab',
			uptime: null,
			up_seconds: 0,
			down_seconds: 0,
			outages: 0,
			covered_from: null,
			covered_to: null,
			windows: [],
			truncated: false,
		});
		expect(parsed.uptime).toBeNull();
	});

	it('keeps the open window open', () => {
		const parsed = WindowsReportSchema.parse({
			from: '2026-08-20T00:00:00Z',
			to: '2026-08-20T10:00:00Z',
			devices: [
				{
					device: 'lab',
					uptime: 100,
					up_seconds: 36000,
					down_seconds: 0,
					outages: 0,
					covered_from: '2026-08-20T00:00:00Z',
					covered_to: '2026-08-20T10:00:00Z',
					windows: [
						{ state: 'up', start_time: '2026-08-20T00:00:00Z', end_time: null, seconds: 36000 },
					],
					truncated: false,
				},
			],
		});
		expect(parsed.devices[0].windows[0].end_time).toBeNull();
	});
});
