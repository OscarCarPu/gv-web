import type * as z from 'zod';
import type { CalendarEventSchema } from '../api/calendar.schemas';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export interface CreateEventRequest {
	name: string;
	/** RFC3339. */
	start_time: string;
	end_time: string;
}

/** Absent fields are left alone — this is a patch, not a replace. */
export interface UpdateEventRequest {
	name?: string;
	start_time?: string;
	end_time?: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';

/** Which of the two sources the grids draw. */
export type CalendarSource = 'events' | 'plans' | 'both';

/** What a grid draws: a calendar event or a plan block, with the times it occupies. */
export interface CalendarItem {
	key: string;
	kind: 'event' | 'plan';
	title: string;
	start: string;
	end: string;
	/** The event it opens: the item itself, or the event a plan block is linked to. */
	event: CalendarEvent | null;
	/** Whether a plan block is linked to this event. */
	planned: boolean;
	block: PlanBlockResponse | null;
}
