import * as z from 'zod';

export const CalendarEventSchema = z.object({
	id: z.number(),
	name: z.string(),
	start_time: z.string(),
	end_time: z.string(),
});

export const CalendarEventListSchema = z.array(CalendarEventSchema);
