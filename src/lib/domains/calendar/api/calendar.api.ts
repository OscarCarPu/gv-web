import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import { CalendarEventListSchema, CalendarEventSchema } from './calendar.schemas';
import type {
	CalendarEvent,
	CreateEventRequest,
	UpdateEventRequest,
} from '../types/Calendar.types';

export interface EventsQuery {
	/** RFC3339 or YYYY-MM-DD. `to` is exclusive. */
	from: string;
	to: string;
}

export const calendarApi = {
	async listEvents(query: EventsQuery, token?: string): Promise<CalendarEvent[]> {
		const params = new URLSearchParams({ from: query.from, to: query.to });
		return fetchAPI(`/calendar/events?${params.toString()}`, CalendarEventListSchema, { token });
	},

	async getEvent(id: number, token?: string): Promise<CalendarEvent> {
		return fetchAPI(`/calendar/events/${id}`, CalendarEventSchema, { token });
	},

	async createEvent(input: CreateEventRequest, token?: string): Promise<CalendarEvent> {
		return fetchAPI('/calendar/events', CalendarEventSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateEvent(id: number, input: UpdateEventRequest, token?: string): Promise<CalendarEvent> {
		return fetchAPI(`/calendar/events/${id}`, CalendarEventSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteEvent(id: number, token?: string): Promise<void> {
		return fetchAPI(`/calendar/events/${id}`, z.void(), { method: 'DELETE', token });
	},
};
