import { describe, it, expect } from 'vitest';
import {
	CalendarEventListSchema,
	CalendarEventSchema,
	CalendarListSchema,
	SyncResultSchema,
	SyncStatusSchema,
} from '$lib/domains/calendar/api/calendar.schemas';

// The API omits empty optional fields and answers `null` instead of `[]` for empty lists, so
// these guard the shape the rest of the domain assumes.

const minimalEvent = {
	instance_id: '7',
	event_id: 7,
	calendar_id: 1,
	account_id: 1,
	account_email: 'me@example.com',
	calendar_name: 'Personal',
	color: '#3b82f6',
	google_event_id: 'g7',
	summary: 'Dentist',
	description: '',
	location: '',
	status: 'confirmed',
	event_type: 'default',
	all_day: false,
	starts_at: '2026-08-20T15:00:00Z',
	ends_at: '2026-08-20T16:00:00Z',
	time_zone: 'Europe/Madrid',
	recurring: false,
	is_exception: false,
	editable: true,
	created_by_gv: false,
};

describe('calendar schemas', () => {
	it('accepts an event with every optional field omitted', () => {
		const parsed = CalendarEventSchema.parse(minimalEvent);
		expect(parsed.recurrence).toBeUndefined();
		expect(parsed.attendees).toBeUndefined();
		expect(parsed.original_starts_at).toBeUndefined();
	});

	it('keeps the fields that describe an occurrence of a series', () => {
		const parsed = CalendarEventSchema.parse({
			...minimalEvent,
			instance_id: '7@2026-08-20T15:00:00Z',
			recurring: true,
			recurrence: ['RRULE:FREQ=DAILY'],
			is_exception: true,
			original_starts_at: '2026-08-20T15:00:00Z',
			attendees: [{ email: 'ana@example.com', response_status: 'accepted' }],
			reminders: { use_default: false, overrides: [{ method: 'popup', minutes: 30 }] },
		});
		expect(parsed.original_starts_at).toBe('2026-08-20T15:00:00Z');
		expect(parsed.attendees?.[0].email).toBe('ana@example.com');
		expect(parsed.reminders?.overrides).toHaveLength(1);
	});

	it('turns a null list into an empty one', () => {
		expect(CalendarEventListSchema.parse(null)).toEqual([]);
		expect(CalendarListSchema.parse(null)).toEqual([]);
		expect(
			SyncResultSchema.parse({ calendars: 0, upserted: 0, deleted: 0, errors: null }).errors
		).toEqual([]);
		const status = SyncStatusSchema.parse({
			configured: false,
			webhooks_active: false,
			poll_interval: '15m0s',
			accounts: null,
			calendars: null,
			recent_runs: null,
		});
		expect(status.accounts).toEqual([]);
		expect(status.calendars).toEqual([]);
		expect(status.recent_runs).toEqual([]);
	});

	it('rejects a payload that is missing something the views rely on', () => {
		const withoutStart: Record<string, unknown> = { ...minimalEvent };
		delete withoutStart.starts_at;
		expect(() => CalendarEventSchema.parse(withoutStart)).toThrow();
	});
});
