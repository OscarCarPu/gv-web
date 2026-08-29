import * as z from 'zod';

const DayFreeBusySchema = z.object({
	date: z.string(),
	capacity_hours: z.string(),
	busy_hours: z.string(),
	free_hours: z.string(),
});

export const FreeBusyRangeResponseSchema = z.object({
	from: z.string(),
	to: z.string(),
	days: z
		.array(DayFreeBusySchema)
		.nullable()
		.transform((v) => v ?? []),
});
