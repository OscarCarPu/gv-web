import * as z from 'zod';

/**
 * Mirrors `gv-api/internal/uptime/dto.go`, which in turn mirrors central-pipeline's marts.
 * snake_case, like every domain except lights.
 *
 * Two things the shapes here deliberately preserve rather than smooth over: `computed_at`
 * is the dbt run time, not now, and `end_time: null` is the open window — the state a
 * device is in at this moment.
 */

export const DEVICES = ['lab', 'watchdog'] as const;
export const DeviceSchema = z.enum(DEVICES);

/** `unknown` is the API's answer for a device the pipeline has never heard from. */
export const StateSchema = z.enum(['up', 'down', 'unknown']);

/** The four precomputed lookbacks, in the order the API returns them. */
export const LOOKBACKS = ['month', '3 months', 'year', 'all'] as const;
export const LookbackSchema = z.enum(LOOKBACKS);

export const RangeUptimeSchema = z.object({
	range: LookbackSchema,
	uptime: z.number(),
	// Floored at the device's first event, so it is not always now - lookback.
	range_start: z.string(),
	range_end: z.string(),
});

export const DeviceOverviewSchema = z.object({
	device: DeviceSchema,
	state: StateSchema,
	// When the device entered this state; also the last event heard from it.
	since: z.string().nullable(),
	ranges: z
		.array(RangeUptimeSchema)
		.nullable()
		.transform((v) => v ?? []),
});

export const OverviewSchema = z.object({
	computed_at: z.string().nullable(),
	stale: z.boolean(),
	stale_after_seconds: z.number(),
	devices: z
		.array(DeviceOverviewSchema)
		.nullable()
		.transform((v) => v ?? []),
});

export const WindowSchema = z.object({
	state: StateSchema,
	start_time: z.string(),
	/** Null means the window is still open. */
	end_time: z.string().nullable(),
	/** Seconds of this window inside the queried range. */
	seconds: z.number(),
});

export const DeviceWindowsSchema = z.object({
	device: DeviceSchema,
	/** Null when no window overlaps the range at all — not zero uptime. */
	uptime: z.number().nullable(),
	up_seconds: z.number(),
	down_seconds: z.number(),
	outages: z.number(),
	covered_from: z.string().nullable(),
	covered_to: z.string().nullable(),
	windows: z
		.array(WindowSchema)
		.nullable()
		.transform((v) => v ?? []),
	truncated: z.boolean(),
});

export const WindowsReportSchema = z.object({
	from: z.string(),
	to: z.string(),
	devices: z
		.array(DeviceWindowsSchema)
		.nullable()
		.transform((v) => v ?? []),
});

export type Device = z.infer<typeof DeviceSchema>;
export type UptimeState = z.infer<typeof StateSchema>;
export type Lookback = z.infer<typeof LookbackSchema>;
export type RangeUptime = z.infer<typeof RangeUptimeSchema>;
export type DeviceOverview = z.infer<typeof DeviceOverviewSchema>;
export type Overview = z.infer<typeof OverviewSchema>;
export type UptimeWindow = z.infer<typeof WindowSchema>;
export type DeviceWindows = z.infer<typeof DeviceWindowsSchema>;
export type WindowsReport = z.infer<typeof WindowsReportSchema>;

/** How each device is labelled in the UI. */
export const DEVICE_LABELS: Record<Device, string> = {
	lab: 'Home lab',
	watchdog: 'Watchdog (ESP32)',
};
