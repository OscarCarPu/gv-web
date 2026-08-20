import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	AuthURLSchema,
	CalendarAccountListSchema,
	CalendarAccountSchema,
	CalendarEventListSchema,
	CalendarEventSchema,
	CalendarListSchema,
	CalendarSchema,
	MoveResultSchema,
	SyncResultSchema,
	SyncStatusSchema,
} from './calendar.schemas';
import type {
	Calendar,
	CalendarAccount,
	CalendarEvent,
	CreateEventRequest,
	EventScope,
	MoveResult,
	SendUpdates,
	SyncResult,
	SyncStatus,
	UpdateAccountRequest,
	UpdateCalendarRequest,
	UpdateEventRequest,
} from '../types/Calendar.types';

export interface EventsQuery {
	/** RFC3339 or YYYY-MM-DD. `to` is exclusive. */
	from: string;
	to: string;
	calendarIds?: number[];
	accountIds?: number[];
	visibleOnly?: boolean;
}

function eventsPath(q: EventsQuery): string {
	const params = new URLSearchParams({ from: q.from, to: q.to });
	if (q.calendarIds?.length) params.set('calendar_ids', q.calendarIds.join(','));
	if (q.accountIds?.length) params.set('account_ids', q.accountIds.join(','));
	if (q.visibleOnly) params.set('visible_only', 'true');
	return `/calendar/events?${params.toString()}`;
}

export const calendarApi = {
	// --- Accounts ---

	async listAccounts(token?: string): Promise<CalendarAccount[]> {
		return fetchAPI('/calendar/accounts', CalendarAccountListSchema, { token });
	},

	/** Returns the Google consent URL. One account per run; it expires in a few minutes. */
	async authUrl(token?: string): Promise<string> {
		const out = await fetchAPI('/calendar/accounts/auth-url', AuthURLSchema, {
			method: 'POST',
			token,
		});
		return out.url;
	},

	async updateAccount(
		id: number,
		input: UpdateAccountRequest,
		token?: string
	): Promise<CalendarAccount> {
		return fetchAPI(`/calendar/accounts/${id}`, CalendarAccountSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	/** Revokes the grant at Google and drops the account's calendars and events. */
	async deleteAccount(id: number, token?: string): Promise<void> {
		return fetchAPI(`/calendar/accounts/${id}`, z.void(), { method: 'DELETE', token });
	},

	async resyncAccount(id: number, token?: string): Promise<SyncResult> {
		return fetchAPI(`/calendar/accounts/${id}/resync`, SyncResultSchema, {
			method: 'POST',
			token,
		});
	},

	// --- Calendars ---

	async listCalendars(token?: string): Promise<Calendar[]> {
		return fetchAPI('/calendar/calendars', CalendarListSchema, { token });
	},

	async updateCalendar(
		id: number,
		input: UpdateCalendarRequest,
		token?: string
	): Promise<Calendar> {
		return fetchAPI(`/calendar/calendars/${id}`, CalendarSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	// --- Events ---

	async listEvents(query: EventsQuery, token?: string): Promise<CalendarEvent[]> {
		return fetchAPI(eventsPath(query), CalendarEventListSchema, { token });
	},

	async getEvent(ref: string, token?: string): Promise<CalendarEvent> {
		return fetchAPI(`/calendar/events/${encodeURIComponent(ref)}`, CalendarEventSchema, { token });
	},

	async createEvent(input: CreateEventRequest, token?: string): Promise<CalendarEvent> {
		return fetchAPI('/calendar/events', CalendarEventSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	/** `ref` is an event id or an occurrence (`12@2026-08-20T07:00:00Z`). */
	async updateEvent(
		ref: string,
		input: UpdateEventRequest,
		token?: string
	): Promise<CalendarEvent> {
		return fetchAPI(`/calendar/events/${encodeURIComponent(ref)}`, CalendarEventSchema, {
			method: 'PATCH',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteEvent(
		ref: string,
		scope?: EventScope,
		sendUpdates?: SendUpdates,
		token?: string
	): Promise<void> {
		const params = new URLSearchParams();
		if (scope) params.set('scope', scope);
		if (sendUpdates) params.set('send_updates', sendUpdates);
		const query = params.toString() ? `?${params.toString()}` : '';
		return fetchAPI(`/calendar/events/${encodeURIComponent(ref)}${query}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	async moveEvent(
		ref: string,
		calendarId: number,
		sendUpdates?: SendUpdates,
		token?: string
	): Promise<MoveResult> {
		return fetchAPI(`/calendar/events/${encodeURIComponent(ref)}/move`, MoveResultSchema, {
			method: 'POST',
			body: JSON.stringify({ calendar_id: calendarId, send_updates: sendUpdates ?? 'none' }),
			token,
		});
	},

	// --- Sync ---

	async sync(calendarId?: number, token?: string): Promise<SyncResult> {
		const query = calendarId ? `?calendar_id=${calendarId}` : '';
		return fetchAPI(`/calendar/sync${query}`, SyncResultSchema, { method: 'POST', token });
	},

	async syncStatus(token?: string): Promise<SyncStatus> {
		return fetchAPI('/calendar/sync/status', SyncStatusSchema, { token });
	},
};
