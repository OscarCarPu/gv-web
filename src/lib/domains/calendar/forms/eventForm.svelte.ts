import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import {
	addDaysToDateInput,
	isoToDateInput,
	isoToLocalInput,
	localInputToISO,
} from '$lib/domains/calendar/utils/datetime';
import type {
	Calendar,
	CalendarEvent,
	EventScope,
	SendUpdates,
} from '$lib/domains/calendar/types/Calendar.types';

export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** The rule a preset means for an event starting on `start`. */
export function presetToRule(preset: RecurrencePreset, start: Date): string[] {
	switch (preset) {
		case 'daily':
			return ['RRULE:FREQ=DAILY'];
		case 'weekly':
			return [`RRULE:FREQ=WEEKLY;BYDAY=${WEEKDAYS[start.getDay()]}`];
		case 'monthly':
			return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`];
		case 'yearly':
			return ['RRULE:FREQ=YEARLY'];
		default:
			return [];
	}
}

/** Which preset an existing rule corresponds to; anything else is left alone as custom. */
export function ruleToPreset(recurrence: string[] | undefined): RecurrencePreset {
	if (!recurrence?.length) return 'none';
	const rule = recurrence.find((line) => line.toUpperCase().startsWith('RRULE'));
	if (!rule) return 'custom';
	const upper = rule.toUpperCase();
	// A rule that also bounds itself (UNTIL/COUNT) or repeats every N is not one of the simple
	// presets, and offering one would silently drop that part of it.
	if (upper.includes('UNTIL=') || upper.includes('COUNT=') || upper.includes('INTERVAL=')) {
		return 'custom';
	}
	if (upper.includes('FREQ=DAILY')) return 'daily';
	if (upper.includes('FREQ=WEEKLY')) return 'weekly';
	if (upper.includes('FREQ=MONTHLY')) return 'monthly';
	if (upper.includes('FREQ=YEARLY')) return 'yearly';
	return 'custom';
}

interface EventFormCallbacks {
	onclose: () => void;
	/** Reload the visible range once the write has landed. */
	refresh: () => Promise<void>;
}

/**
 * Owns the create/edit sheet: the editable fields, the all-day switch, the recurrence preset,
 * and the scope of a change to a recurring series.
 *
 * Two conversions live here because getting either wrong moves people's appointments:
 * a timed event is a real instant (so the local input is converted with the zone offset, not
 * the shared `toISOString`), and an all-day event's end is exclusive in the API while the form
 * shows the last day it covers.
 */
export class EventForm {
	#onclose: () => void;
	#refresh: () => Promise<void>;
	#getCalendars: () => Calendar[];

	event = $state<CalendarEvent | null>(null);

	calendarId = $state<number | null>(null);
	summary = $state('');
	description = $state('');
	location = $state('');
	allDay = $state(false);
	/** `YYYY-MM-DDTHH:MM` when timed, `YYYY-MM-DD` when all day. */
	startsAt = $state('');
	endsAt = $state('');
	recurrence = $state<RecurrencePreset>('none');
	scope = $state<EventScope>('instance');
	sendUpdates = $state<SendUpdates>('none');

	saving = $state(false);
	deleting = $state(false);
	summaryError = $state(false);
	timeError = $state(false);
	/** The original rule, kept so a custom one survives an edit untouched. */
	#originalRecurrence: string[] = [];

	constructor(getCalendars: () => Calendar[], callbacks: EventFormCallbacks) {
		this.#getCalendars = getCalendars;
		this.#onclose = callbacks.onclose;
		this.#refresh = callbacks.refresh;
	}

	get calendars(): Calendar[] {
		return this.#getCalendars();
	}

	get isEdit(): boolean {
		return this.event !== null;
	}

	/** Only a series occurrence can be scoped; everything else edits the one event. */
	get canScope(): boolean {
		return !!this.event?.recurring && !!this.event?.original_starts_at;
	}

	/** The rule belongs to the series, so it can only be changed when editing all of it. */
	get canEditRecurrence(): boolean {
		return !this.isEdit || !this.canScope || this.scope === 'all';
	}

	get hasAttendees(): boolean {
		return (this.event?.attendees?.length ?? 0) > 0;
	}

	/** Seeds the form. `day` pre-fills a new event when the user clicked a specific day. */
	reset(event: CalendarEvent | null, defaultCalendarId: number | undefined, day?: Date) {
		this.event = event;
		this.saving = false;
		this.deleting = false;
		this.summaryError = false;
		this.timeError = false;
		this.sendUpdates = 'none';

		if (event) {
			this.calendarId = event.calendar_id;
			this.summary = event.summary;
			this.description = event.description;
			this.location = event.location;
			this.allDay = event.all_day;
			// All-day edges come from the API's dates, not from converting its instants: those are
			// midnight in the calendar's zone, so converting them here would shift the day.
			this.startsAt = event.all_day
				? (event.start_date ?? isoToDateInput(event.starts_at))
				: isoToLocalInput(event.starts_at);
			// An all-day end is exclusive in the API; the form shows the last day covered.
			this.endsAt = event.all_day
				? addDaysToDateInput(event.end_date ?? isoToDateInput(event.ends_at), -1)
				: isoToLocalInput(event.ends_at);
			this.#originalRecurrence = event.recurrence ?? [];
			this.recurrence = ruleToPreset(event.recurrence);
			this.scope = event.recurring ? 'instance' : 'all';
			return;
		}

		// The caller decides the hour — an hour slot in the time grid carries the one that was
		// clicked, and the month grid picks a sensible morning. Overwriting it here would create
		// the event somewhere the user did not click.
		const base = day ? new Date(day) : new Date();
		if (day) {
			base.setSeconds(0, 0);
		} else {
			base.setHours(base.getHours() + 1, 0, 0, 0);
		}
		const end = new Date(base.getTime() + 60 * 60 * 1000);
		this.calendarId = defaultCalendarId ?? null;
		this.summary = '';
		this.description = '';
		this.location = '';
		this.allDay = false;
		this.startsAt = isoToLocalInput(base.toISOString());
		this.endsAt = isoToLocalInput(end.toISOString());
		this.#originalRecurrence = [];
		this.recurrence = 'none';
		this.scope = 'all';
	}

	/** Switching the all-day toggle rewrites both edges into the other format. */
	setAllDay(allDay: boolean) {
		if (allDay === this.allDay) return;
		if (allDay) {
			this.startsAt = this.startsAt.slice(0, 10);
			this.endsAt = this.endsAt ? this.endsAt.slice(0, 10) : this.startsAt;
		} else {
			this.startsAt = `${this.startsAt.slice(0, 10)}T09:00`;
			this.endsAt = `${(this.endsAt || this.startsAt).slice(0, 10)}T10:00`;
		}
		this.allDay = allDay;
		this.timeError = false;
	}

	private validate(): boolean {
		this.summaryError = this.summary.trim() === '';
		const start = this.allDay ? new Date(`${this.startsAt}T00:00`) : new Date(this.startsAt || '');
		const end = this.allDay ? new Date(`${this.endsAt}T00:00`) : new Date(this.endsAt || '');
		this.timeError =
			!this.startsAt ||
			Number.isNaN(start.getTime()) ||
			(!!this.endsAt &&
				(Number.isNaN(end.getTime()) || (this.allDay ? end < start : end <= start)));
		return !this.summaryError && !this.timeError && this.calendarId !== null;
	}

	private recurrenceForRequest(): string[] | undefined {
		if (!this.canEditRecurrence) return undefined;
		if (this.recurrence === 'custom') return this.#originalRecurrence;
		if (this.recurrence === 'none') return [];
		const start = this.allDay ? new Date(`${this.startsAt}T00:00`) : new Date(this.startsAt);
		return presetToRule(this.recurrence, start);
	}

	async save() {
		if (this.saving || !this.validate()) return;
		this.saving = true;
		try {
			if (this.event) {
				await calendarApi.updateEvent(this.event.instance_id, {
					summary: this.summary.trim(),
					description: this.description,
					location: this.location,
					all_day: this.allDay,
					starts_at: this.apiStart(),
					ends_at: this.apiEnd(),
					recurrence: this.recurrenceForRequest(),
					scope: this.canScope ? this.scope : undefined,
					send_updates: this.sendUpdates,
				});
				addToast('Event updated');
			} else {
				const recurrence = this.recurrenceForRequest();
				await calendarApi.createEvent({
					calendar_id: this.calendarId as number,
					summary: this.summary.trim(),
					description: this.description,
					location: this.location,
					all_day: this.allDay,
					starts_at: this.apiStart(),
					ends_at: this.apiEnd(),
					recurrence: recurrence?.length ? recurrence : undefined,
					send_updates: this.sendUpdates,
				});
				addToast('Event created');
			}
			await this.#refresh();
			this.#onclose();
		} catch (e) {
			addToast(this.explain(e), 'error');
		} finally {
			this.saving = false;
		}
	}

	async remove() {
		if (!this.event || this.deleting) return;
		this.deleting = true;
		try {
			await calendarApi.deleteEvent(
				this.event.instance_id,
				this.canScope ? this.scope : undefined,
				this.sendUpdates
			);
			addToast('Event deleted');
			await this.#refresh();
			this.#onclose();
		} catch (e) {
			addToast(this.explain(e), 'error');
		} finally {
			this.deleting = false;
		}
	}

	async move(calendarId: number) {
		if (!this.event) return;
		this.saving = true;
		try {
			const result = await calendarApi.moveEvent(
				this.event.instance_id,
				calendarId,
				this.sendUpdates
			);
			addToast(
				result.recreated
					? 'Moved to another account — the event was recreated there'
					: 'Event moved'
			);
			await this.#refresh();
			this.#onclose();
		} catch (e) {
			addToast(this.explain(e), 'error');
		} finally {
			this.saving = false;
		}
	}

	private apiStart(): string {
		return this.allDay ? this.startsAt : localInputToISO(this.startsAt);
	}

	private apiEnd(): string | undefined {
		if (!this.endsAt) return undefined;
		// The API takes an exclusive end for all-day events; the form collects the last day.
		return this.allDay ? addDaysToDateInput(this.endsAt, 1) : localInputToISO(this.endsAt);
	}

	/** Turns the API's answers into something worth reading. */
	private explain(error: unknown): string {
		const message = error instanceof Error ? error.message : 'Something went wrong';
		if (message.includes('refetch and retry')) {
			return 'This event changed in Google while you were editing it. Reload and try again.';
		}
		if (message.includes('reconnected')) {
			return 'That Google account needs to be reconnected.';
		}
		if (message.includes('read-only')) {
			return 'That calendar is read-only in Google.';
		}
		return message;
	}
}
