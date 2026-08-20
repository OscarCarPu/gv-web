import type * as z from 'zod';
import type {
	CalendarSchema,
	CalendarEventSchema,
	CalendarAccountSchema,
	SyncStatusSchema,
	SyncResultSchema,
	MoveResultSchema,
	AttendeeSchema,
} from '../api/calendar.schemas';

export type Calendar = z.infer<typeof CalendarSchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CalendarAccount = z.infer<typeof CalendarAccountSchema>;
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type MoveResult = z.infer<typeof MoveResultSchema>;
export type Attendee = z.infer<typeof AttendeeSchema>;

/** What a change touches on a recurring series. */
export type EventScope = 'all' | 'instance' | 'following';

/** Who gets mailed about the change. The API defaults to 'none'. */
export type SendUpdates = 'none' | 'externalOnly' | 'all';

export interface CreateEventRequest {
	calendar_id: number;
	summary: string;
	description?: string;
	location?: string;
	all_day?: boolean;
	/** RFC3339, or YYYY-MM-DD when all_day. */
	starts_at: string;
	ends_at?: string;
	time_zone?: string;
	recurrence?: string[];
	send_updates?: SendUpdates;
}

/** Absent fields are left alone — this is a patch, not a replace. */
export interface UpdateEventRequest {
	summary?: string;
	description?: string;
	location?: string;
	all_day?: boolean;
	starts_at?: string;
	ends_at?: string;
	time_zone?: string;
	recurrence?: string[];
	scope?: EventScope;
	send_updates?: SendUpdates;
}

export interface UpdateCalendarRequest {
	sync_enabled?: boolean;
	visible?: boolean;
	color_override?: string;
}

export interface UpdateAccountRequest {
	label?: string;
	color?: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';
