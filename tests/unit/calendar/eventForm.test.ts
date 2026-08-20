import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Calendar, CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const moveEvent = vi.fn();

vi.mock('$lib/domains/calendar/api/calendar.api', () => ({
	calendarApi: {
		createEvent: (...a: unknown[]) => createEvent(...a),
		updateEvent: (...a: unknown[]) => updateEvent(...a),
		deleteEvent: (...a: unknown[]) => deleteEvent(...a),
		moveEvent: (...a: unknown[]) => moveEvent(...a),
	},
}));

const toasts: { message: string; type?: string }[] = [];
vi.mock('$lib/shared/stores/toast.svelte', () => ({
	addToast: (message: string, type?: string) => toasts.push({ message, type }),
}));

function calendar(over: Partial<Calendar> = {}): Calendar {
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

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		instance_id: '7',
		event_id: 7,
		calendar_id: 1,
		account_id: 1,
		account_email: 'me@example.com',
		calendar_name: 'Personal',
		color: '#3b82f6',
		google_event_id: 'g7',
		summary: 'Dentist',
		description: 'second floor',
		location: 'Clínica',
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
		...over,
	};
}

describe('EventForm', () => {
	let EventForm: typeof import('$lib/domains/calendar/forms/eventForm.svelte').EventForm;
	let presetToRule: typeof import('$lib/domains/calendar/forms/eventForm.svelte').presetToRule;
	let ruleToPreset: typeof import('$lib/domains/calendar/forms/eventForm.svelte').ruleToPreset;
	let closed: number;
	let refreshed: number;

	function newForm(calendars: Calendar[] = [calendar()]) {
		return new EventForm(() => calendars, {
			onclose: () => {
				closed++;
			},
			refresh: async () => {
				refreshed++;
			},
		});
	}

	beforeEach(async () => {
		vi.clearAllMocks();
		toasts.length = 0;
		closed = 0;
		refreshed = 0;
		createEvent.mockResolvedValue(event());
		updateEvent.mockResolvedValue(event());
		deleteEvent.mockResolvedValue(undefined);
		moveEvent.mockResolvedValue({ event: event(), recreated: false });
		const module = await import('$lib/domains/calendar/forms/eventForm.svelte');
		EventForm = module.EventForm;
		presetToRule = module.presetToRule;
		ruleToPreset = module.ruleToPreset;
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe('recurrence presets', () => {
		it('builds a rule anchored to the day the event starts on', () => {
			const monday = new Date(2026, 7, 17);
			expect(presetToRule('daily', monday)).toEqual(['RRULE:FREQ=DAILY']);
			expect(presetToRule('weekly', monday)).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
			expect(presetToRule('monthly', monday)).toEqual(['RRULE:FREQ=MONTHLY;BYMONTHDAY=17']);
			expect(presetToRule('yearly', monday)).toEqual(['RRULE:FREQ=YEARLY']);
			expect(presetToRule('none', monday)).toEqual([]);
		});

		it('recognises a simple rule and refuses to simplify a bounded one', () => {
			expect(ruleToPreset(undefined)).toBe('none');
			expect(ruleToPreset(['RRULE:FREQ=WEEKLY;BYDAY=TH'])).toBe('weekly');
			// Offering "Daily" for these would quietly drop the part that bounds them.
			expect(ruleToPreset(['RRULE:FREQ=DAILY;COUNT=14'])).toBe('custom');
			expect(ruleToPreset(['RRULE:FREQ=DAILY;UNTIL=20260901T000000Z'])).toBe('custom');
			expect(ruleToPreset(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO'])).toBe('custom');
		});
	});

	describe('seeding', () => {
		it('shows the last day covered for an all-day event, not the exclusive end', () => {
			const form = newForm();
			// 20 to 23 Aug exclusive is a three-day event ending on the 22nd.
			form.reset(
				event({
					all_day: true,
					starts_at: '2026-08-19T22:00:00Z',
					ends_at: '2026-08-22T22:00:00Z',
				}),
				1
			);
			expect(form.allDay).toBe(true);
			expect(form.startsAt).toBe('2026-08-20');
			expect(form.endsAt).toBe('2026-08-22');
		});

		it('seeds a timed event in local wall-clock time', () => {
			const form = newForm();
			form.reset(event(), 1);
			expect(form.startsAt).toBe('2026-08-20T17:00');
			expect(form.endsAt).toBe('2026-08-20T18:00');
			expect(form.summary).toBe('Dentist');
			expect(form.canScope).toBe(false);
		});

		it('starts a new event on the day that was clicked', () => {
			const form = newForm();
			form.reset(null, 4, new Date(2026, 7, 23, 15, 0));
			expect(form.calendarId).toBe(4);
			expect(form.startsAt).toBe('2026-08-23T15:00');
			expect(form.endsAt).toBe('2026-08-23T16:00');
			expect(form.recurrence).toBe('none');
		});

		it('defaults a series occurrence to editing just that occurrence', () => {
			const form = newForm();
			form.reset(
				event({
					recurring: true,
					recurrence: ['RRULE:FREQ=DAILY'],
					original_starts_at: '2026-08-20T15:00:00Z',
					instance_id: '7@2026-08-20T15:00:00Z',
				}),
				1
			);
			expect(form.canScope).toBe(true);
			expect(form.scope).toBe('instance');
			// The rule belongs to the series, so it is off limits until the scope says so.
			expect(form.canEditRecurrence).toBe(false);
			form.scope = 'all';
			expect(form.canEditRecurrence).toBe(true);
		});
	});

	describe('the all-day switch', () => {
		it('rewrites both edges in each direction', () => {
			const form = newForm();
			form.reset(event(), 1);
			form.setAllDay(true);
			expect(form.startsAt).toBe('2026-08-20');
			expect(form.endsAt).toBe('2026-08-20');
			form.setAllDay(false);
			expect(form.startsAt).toBe('2026-08-20T09:00');
			expect(form.endsAt).toBe('2026-08-20T10:00');
		});
	});

	describe('saving', () => {
		it('creates a timed event as a real instant', async () => {
			const form = newForm();
			form.reset(null, 1);
			form.summary = '  Dentist  ';
			form.startsAt = '2026-08-20T17:00';
			form.endsAt = '2026-08-20T18:00';
			await form.save();

			expect(createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					calendar_id: 1,
					summary: 'Dentist',
					all_day: false,
					starts_at: '2026-08-20T15:00:00.000Z',
					ends_at: '2026-08-20T16:00:00.000Z',
					send_updates: 'none',
				})
			);
			expect(refreshed).toBe(1);
			expect(closed).toBe(1);
		});

		it('creates an all-day event with the exclusive end the API expects', async () => {
			const form = newForm();
			form.reset(null, 1);
			form.summary = 'Trip';
			form.setAllDay(true);
			form.startsAt = '2026-08-20';
			form.endsAt = '2026-08-22';
			await form.save();

			expect(createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					all_day: true,
					starts_at: '2026-08-20',
					// One past the last day the user picked.
					ends_at: '2026-08-23',
				})
			);
		});

		it('sends the recurrence rule built from the preset', async () => {
			const form = newForm();
			form.reset(null, 1, new Date(2026, 7, 20)); // a Thursday
			form.summary = 'Standup';
			form.recurrence = 'weekly';
			await form.save();

			expect(createEvent).toHaveBeenCalledWith(
				expect.objectContaining({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=TH'] })
			);
		});

		it('patches an occurrence with its instance reference and scope', async () => {
			const form = newForm();
			form.reset(
				event({
					recurring: true,
					recurrence: ['RRULE:FREQ=DAILY'],
					original_starts_at: '2026-08-20T15:00:00Z',
					instance_id: '7@2026-08-20T15:00:00Z',
				}),
				1
			);
			form.summary = 'Dentist (moved)';
			form.scope = 'following';
			await form.save();

			expect(updateEvent).toHaveBeenCalledWith(
				'7@2026-08-20T15:00:00Z',
				expect.objectContaining({ summary: 'Dentist (moved)', scope: 'following' })
			);
		});

		it('keeps a custom rule untouched when editing the series', async () => {
			const form = newForm();
			form.reset(
				event({
					recurring: true,
					recurrence: ['RRULE:FREQ=DAILY;COUNT=14'],
					original_starts_at: '2026-08-20T15:00:00Z',
					instance_id: '7@2026-08-20T15:00:00Z',
				}),
				1
			);
			form.scope = 'all';
			form.summary = 'Standup';
			await form.save();

			expect(updateEvent).toHaveBeenCalledWith(
				'7@2026-08-20T15:00:00Z',
				expect.objectContaining({ recurrence: ['RRULE:FREQ=DAILY;COUNT=14'] })
			);
		});

		it('refuses an empty title or a backwards range without calling the API', async () => {
			const form = newForm();
			form.reset(null, 1);
			form.summary = '   ';
			await form.save();
			expect(form.summaryError).toBe(true);
			expect(createEvent).not.toHaveBeenCalled();

			form.summary = 'Dentist';
			form.startsAt = '2026-08-20T18:00';
			form.endsAt = '2026-08-20T17:00';
			await form.save();
			expect(form.timeError).toBe(true);
			expect(createEvent).not.toHaveBeenCalled();
		});

		it('translates a conflict from the API into something a person can act on', async () => {
			updateEvent.mockRejectedValueOnce(new Error('event changed in google, refetch and retry'));
			const form = newForm();
			form.reset(event(), 1);
			form.summary = 'Dentist';
			await form.save();

			expect(toasts.at(-1)).toEqual({
				message: 'This event changed in Google while you were editing it. Reload and try again.',
				type: 'error',
			});
			expect(closed).toBe(0);
		});
	});

	describe('deleting and moving', () => {
		it('deletes with the chosen scope', async () => {
			const form = newForm();
			form.reset(
				event({
					recurring: true,
					recurrence: ['RRULE:FREQ=DAILY'],
					original_starts_at: '2026-08-20T15:00:00Z',
					instance_id: '7@2026-08-20T15:00:00Z',
				}),
				1
			);
			form.scope = 'instance';
			await form.remove();
			expect(deleteEvent).toHaveBeenCalledWith('7@2026-08-20T15:00:00Z', 'instance', 'none');
			expect(closed).toBe(1);
		});

		it('says so when a cross-account move recreated the event', async () => {
			moveEvent.mockResolvedValueOnce({ event: event(), recreated: true });
			const form = newForm();
			form.reset(event(), 1);
			await form.move(2);
			expect(moveEvent).toHaveBeenCalledWith('7', 2, 'none');
			expect(toasts.at(-1)?.message).toContain('recreated');
		});
	});
});
