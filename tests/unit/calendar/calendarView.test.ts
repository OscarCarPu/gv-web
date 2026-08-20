import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Calendar, CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

const listEvents = vi.fn();
const listCalendars = vi.fn();
const updateCalendar = vi.fn();
const sync = vi.fn();

vi.mock('$lib/domains/calendar/api/calendar.api', () => ({
	calendarApi: {
		listEvents: (...args: unknown[]) => listEvents(...args),
		listCalendars: (...args: unknown[]) => listCalendars(...args),
		updateCalendar: (...args: unknown[]) => updateCalendar(...args),
		sync: (...args: unknown[]) => sync(...args),
	},
}));

function makeCalendar(over: Partial<Calendar> = {}): Calendar {
	return {
		id: 1,
		account_id: 1,
		account_email: 'me@example.com',
		account_status: 'connected',
		google_calendar_id: 'me@example.com',
		summary: 'Personal',
		description: '',
		time_zone: 'Europe/Madrid',
		color: '#3b82f6',
		background_color: '#9fe1e7',
		foreground_color: '',
		access_role: 'owner',
		writable: true,
		is_primary: true,
		sync_enabled: true,
		visible: true,
		deleted: false,
		sync: {
			has_sync_token: true,
			last_sync_at: null,
			last_full_sync_at: null,
			last_sync_error: null,
			watch_active: true,
			watch_expires_at: null,
		},
		...over,
	};
}

function makeEvent(over: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		instance_id: '1',
		event_id: 1,
		calendar_id: 1,
		account_id: 1,
		account_email: 'me@example.com',
		calendar_name: 'Personal',
		color: '#3b82f6',
		google_event_id: 'g1',
		summary: 'Standup',
		description: '',
		location: '',
		status: 'confirmed',
		event_type: 'default',
		all_day: false,
		starts_at: '2026-08-20T07:00:00Z',
		ends_at: '2026-08-20T07:30:00Z',
		time_zone: 'Europe/Madrid',
		recurring: false,
		is_exception: false,
		editable: true,
		created_by_gv: false,
		...over,
	};
}

describe('CalendarView', () => {
	let CalendarView: typeof import('$lib/domains/calendar/calendarView.svelte').CalendarView;
	let occupiesDay: typeof import('$lib/domains/calendar/calendarView.svelte').occupiesDay;

	beforeEach(async () => {
		vi.clearAllMocks();
		listEvents.mockResolvedValue([]);
		listCalendars.mockResolvedValue([]);
		const module = await import('$lib/domains/calendar/calendarView.svelte');
		CalendarView = module.CalendarView;
		occupiesDay = module.occupiesDay;
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe('the visible range', () => {
		it('covers whole weeks in month mode, starting on Monday', () => {
			const view = new CalendarView([], []);
			// August 2026 starts on a Saturday, so the grid opens on Monday 27 July.
			view.anchor = new Date(2026, 7, 20);

			expect(view.rangeStart.getDay()).toBe(1);
			expect(view.rangeStart.getDate()).toBe(27);
			expect(view.rangeStart.getMonth()).toBe(6);
			expect(view.monthWeeks).toBe(6);
			expect(view.days).toHaveLength(42);
			expect(view.title).toBe('August 2026');
		});

		it('uses five rows for a month that fits in five weeks', () => {
			const view = new CalendarView([], []);
			// February 2027 starts on a Monday and has 28 days: exactly four weeks.
			view.anchor = new Date(2027, 1, 10);
			expect(view.monthWeeks).toBe(4);
			expect(view.days).toHaveLength(28);
		});

		it('is Monday to Sunday in week mode', () => {
			const view = new CalendarView([], [], 'week');
			view.anchor = new Date(2026, 7, 20); // a Thursday
			expect(view.rangeStart.getDate()).toBe(17);
			expect(view.days).toHaveLength(7);
			expect(view.title).toBe('Aug 17 – Aug 23, 2026');
		});

		it('is a single day in day mode', () => {
			const view = new CalendarView([], [], 'day');
			view.anchor = new Date(2026, 7, 20);
			expect(view.days).toHaveLength(1);
			expect(view.title).toBe('Thursday, August 20, 2026');
		});
	});

	describe('navigation', () => {
		it('steps by month, week or day and refetches', async () => {
			const view = new CalendarView([], []);
			view.anchor = new Date(2026, 7, 20);

			view.shift(1);
			expect(view.anchor.getMonth()).toBe(8);
			view.shift(-1);
			expect(view.anchor.getMonth()).toBe(7);

			view.mode = 'week';
			view.shift(1);
			expect(view.anchor.getDate()).toBe(8); // month shifts snap to the 1st, then +7
			view.mode = 'day';
			view.shift(-1);
			expect(view.anchor.getDate()).toBe(7);

			expect(listEvents).toHaveBeenCalled();
		});

		it('drills into a day from the month grid', () => {
			const view = new CalendarView([], []);
			view.openDay(new Date(2026, 7, 23, 15, 30));
			expect(view.mode).toBe('day');
			expect(view.anchor.getDate()).toBe(23);
			expect(view.anchor.getHours()).toBe(0);
		});

		it('knows whether now is inside the range', () => {
			const view = new CalendarView([], []);
			view.anchor = new Date();
			expect(view.isCurrentPeriod).toBe(true);
			view.anchor = new Date(2019, 0, 15);
			expect(view.isCurrentPeriod).toBe(false);
		});
	});

	describe('which events land on a day', () => {
		it('counts an event on every day it overlaps', () => {
			// 20 Aug 00:00 to 23 Aug 00:00 Madrid, the way the API stores an all-day trip.
			const trip = makeEvent({
				all_day: true,
				starts_at: '2026-08-19T22:00:00Z',
				ends_at: '2026-08-22T22:00:00Z',
			});
			expect(occupiesDay(trip, new Date(2026, 7, 20))).toBe(true);
			expect(occupiesDay(trip, new Date(2026, 7, 21))).toBe(true);
			expect(occupiesDay(trip, new Date(2026, 7, 22))).toBe(true);
			// The end is exclusive: the trip does not reach into the 23rd, nor back to the 19th.
			expect(occupiesDay(trip, new Date(2026, 7, 23))).toBe(false);
			expect(occupiesDay(trip, new Date(2026, 7, 19))).toBe(false);
		});

		it('treats a zero-length event as happening on its own day', () => {
			const instant = makeEvent({
				starts_at: '2026-08-20T07:00:00Z',
				ends_at: '2026-08-20T07:00:00Z',
			});
			expect(occupiesDay(instant, new Date(2026, 7, 20))).toBe(true);
			expect(occupiesDay(instant, new Date(2026, 7, 21))).toBe(false);
		});

		it('splits a day into all-day and timed, in time order', () => {
			const view = new CalendarView(
				[],
				[
					makeEvent({
						instance_id: 'b',
						starts_at: '2026-08-20T12:00:00Z',
						ends_at: '2026-08-20T13:00:00Z',
					}),
					makeEvent({
						instance_id: 'a',
						starts_at: '2026-08-20T07:00:00Z',
						ends_at: '2026-08-20T08:00:00Z',
					}),
					makeEvent({
						instance_id: 'c',
						all_day: true,
						starts_at: '2026-08-19T22:00:00Z',
						ends_at: '2026-08-20T22:00:00Z',
					}),
				]
			);
			const day = new Date(2026, 7, 20);
			expect(view.allDayOn(day).map((e) => e.instance_id)).toEqual(['c']);
			expect(view.timedOn(day).map((e) => e.instance_id)).toEqual(['a', 'b']);
		});
	});

	describe('calendars', () => {
		it('offers only writable, synced calendars for new events, primary first', () => {
			const view = new CalendarView(
				[
					makeCalendar({ id: 1, is_primary: false, summary: 'Other' }),
					makeCalendar({ id: 2, writable: false, summary: 'Holidays' }),
					makeCalendar({ id: 3, sync_enabled: false, summary: 'Off' }),
					makeCalendar({ id: 4, is_primary: true, summary: 'Primary' }),
					makeCalendar({ id: 5, deleted: true, summary: 'Gone' }),
				],
				[]
			);
			expect(view.writableCalendars.map((c) => c.id)).toEqual([1, 4]);
			expect(view.defaultCalendarId).toBe(4);
		});

		it('groups calendars by account for the sidebar', () => {
			const view = new CalendarView(
				[
					makeCalendar({ id: 1, account_email: 'a@x' }),
					makeCalendar({ id: 2, account_email: 'b@x', account_id: 2 }),
					makeCalendar({ id: 3, account_email: 'a@x' }),
				],
				[]
			);
			const groups = view.calendarsByAccount;
			expect(groups.map((g) => g.email)).toEqual(['a@x', 'b@x']);
			expect(groups[0].calendars.map((c) => c.id)).toEqual([1, 3]);
		});

		it('persists a visibility change and refetches', async () => {
			const calendar = makeCalendar();
			updateCalendar.mockResolvedValue({ ...calendar, visible: false });
			const view = new CalendarView([calendar], []);

			await view.toggleCalendarVisible(calendar);

			expect(updateCalendar).toHaveBeenCalledWith(1, { visible: false });
			expect(view.calendars[0].visible).toBe(false);
			expect(listEvents).toHaveBeenCalled();
		});

		it('syncs a calendar the moment it is switched on', async () => {
			const calendar = makeCalendar({ sync_enabled: false });
			updateCalendar.mockResolvedValue({ ...calendar, sync_enabled: true });
			sync.mockResolvedValue({ calendars: 1, upserted: 3, deleted: 0, errors: [] });
			const view = new CalendarView([calendar], []);

			await view.toggleCalendarSync(calendar);

			expect(updateCalendar).toHaveBeenCalledWith(1, { sync_enabled: true });
			expect(sync).toHaveBeenCalledWith(1);
		});
	});

	describe('loading', () => {
		it('asks only for the visible calendars, over the visible range', async () => {
			const view = new CalendarView([], []);
			view.anchor = new Date(2026, 7, 20);
			await view.load();

			expect(listEvents).toHaveBeenCalledWith({
				from: view.rangeStart.toISOString(),
				to: view.rangeEnd.toISOString(),
				visibleOnly: true,
			});
		});

		it('keeps the newest answer when two requests overlap', async () => {
			const view = new CalendarView([], []);
			const slow = makeEvent({ instance_id: 'slow' });
			const fast = makeEvent({ instance_id: 'fast' });
			let releaseSlow: (value: CalendarEvent[]) => void = () => {};
			listEvents
				.mockImplementationOnce(() => new Promise((resolve) => (releaseSlow = resolve)))
				.mockResolvedValueOnce([fast]);

			const first = view.load();
			const second = view.load();
			await second;
			releaseSlow([slow]);
			await first;

			// The stale request must not overwrite the range the user is actually looking at.
			expect(view.events.map((e) => e.instance_id)).toEqual(['fast']);
		});

		it('surfaces a failure without wiping what is on screen', async () => {
			const view = new CalendarView([], [makeEvent({ instance_id: 'kept' })]);
			listEvents.mockRejectedValueOnce(new Error('Unauthorized'));
			await view.load();
			expect(view.error).toBe('Unauthorized');
			expect(view.events.map((e) => e.instance_id)).toEqual(['kept']);
		});
	});
});
