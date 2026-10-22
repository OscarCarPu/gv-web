import * as z from 'zod';

export const KindSchema = z.enum(['up', 'down', 'failover']);

export const LOOKBACKS = ['month', '3 months', 'year', 'all'] as const;
export const LookbackSchema = z.enum(LOOKBACKS);

export const RangeUptimeSchema = z.object({
	range: LookbackSchema,
	uptime: z.number().nullable(),
	up_seconds: z.number(),
	down_seconds: z.number(),
	failover_seconds: z.number(),
	range_start: z.string(),
	range_end: z.string(),
});

export const OverviewSchema = z.object({
	up_since: z.string(),
	ranges: z
		.array(RangeUptimeSchema)
		.nullable()
		.transform((v) => v ?? []),
});

export const WindowSchema = z.object({
	kind: KindSchema,
	start_time: z.string(),
	end_time: z.string(),
	seconds: z.number(),
});

export const WindowsReportSchema = z.object({
	from: z.string(),
	to: z.string(),
	uptime: z.number().nullable(),
	up_seconds: z.number(),
	down_seconds: z.number(),
	failover_seconds: z.number(),
	outages: z.number(),
	windows: z
		.array(WindowSchema)
		.nullable()
		.transform((v) => v ?? []),
	truncated: z.boolean(),
});

export type Kind = z.infer<typeof KindSchema>;
export type Lookback = z.infer<typeof LookbackSchema>;
export type RangeUptime = z.infer<typeof RangeUptimeSchema>;
export type Overview = z.infer<typeof OverviewSchema>;
export type UptimeWindow = z.infer<typeof WindowSchema>;
export type WindowsReport = z.infer<typeof WindowsReportSchema>;

export const KIND_LABELS: Record<Kind, string> = {
	up: 'Up',
	down: 'Down',
	failover: 'Failover (served from the backup server)',
};
