import { calendarApi } from './api/calendar.api';
import type { Calendar, CalendarEvent, CalendarViewMode } from './types/Calendar.types';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { toLocalDateString } from '$lib/shared/utils/datetime';

/** Monday-first, which is what a Spanish calendar looks like. */
const WEEK_START = 1;

function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + days);
	return d;
}

function startOfWeek(date: Date): Date {
	const d = startOfDay(date);
	const shift = (d.getDay() - WEEK_START + 7) % 7;
	return addDays(d, -shift);
}

export function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * An event occupies a day when it overlaps that day at all, so a multi-day trip shows on every
 * day it covers. The end is exclusive, matching the API.
 *
 * An all-day event is compared as dates, never as instants. Its instants are midnight in the
 * *calendar's* zone, and calendars disagree about that — some report UTC, some Europe/Madrid — so
 * converting them into the viewer's zone spreads a one-day event over two local days, which reads
 * as a duplicate. The dates from the API are the ones Google holds, and they are what a person
 * sees in Google.
 */
export function occupiesDay(event: CalendarEvent, day: Date): boolean {
	if (event.all_day && event.start_date && event.end_date) {
		const date = toLocalDateString(day);
		return date >= event.start_date && date < event.end_date;
	}
	const dayStart = startOfDay(day).getTime();
	const dayEnd = addDays(startOfDay(day), 1).getTime();
	const start = new Date(event.starts_at).getTime();
	const end = new Date(event.ends_at).getTime();
	if (end === start) return start >= dayStart && start < dayEnd;
	return start < dayEnd && end > dayStart;
}

const titleMonth = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
const titleDay = new Intl.DateTimeFormat('en', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
});
const titleRange = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });

/**
 * CalendarView owns everything the calendar page shows: which range is on screen, the events in
 * it, and the calendars they come from.
 *
 * It exists as a controller rather than page state because three things can change the events
 * on screen — navigating, toggling a calendar, and a push notification arriving over SSE — and
 * they all have to funnel into the same single refetch of the same single range.
 */
export class CalendarView {
	mode = $state<CalendarViewMode>('month');
	/** Any instant inside the visible range; the range is derived from it and the mode. */
	anchor = $state<Date>(startOfDay(new Date()));
	calendars = $state<Calendar[]>([]);
	events = $state<CalendarEvent[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	/** Set while a push notification is being followed up, so the UI can show it is live. */
	live = $state(false);

	private stream: EventSource | null = null;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private requestId = 0;

	constructor(calendars: Calendar[], events: CalendarEvent[], mode: CalendarViewMode = 'month') {
		this.calendars = calendars;
		this.events = events;
		this.mode = mode;
	}

	// --- range -------------------------------------------------------------------------

	get rangeStart(): Date {
		if (this.mode === 'day') return startOfDay(this.anchor);
		if (this.mode === 'week') return startOfWeek(this.anchor);
		// A month view shows whole weeks, so the range starts on the Monday before the 1st.
		const firstOfMonth = new Date(this.anchor.getFullYear(), this.anchor.getMonth(), 1);
		return startOfWeek(firstOfMonth);
	}

	get rangeEnd(): Date {
		if (this.mode === 'day') return addDays(this.rangeStart, 1);
		if (this.mode === 'week') return addDays(this.rangeStart, 7);
		return addDays(this.rangeStart, this.monthWeeks * 7);
	}

	/** Six weeks unless five cover the month, so the grid does not jump height every month. */
	get monthWeeks(): number {
		const firstOfNext = new Date(this.anchor.getFullYear(), this.anchor.getMonth() + 1, 1);
		const days = Math.round((firstOfNext.getTime() - this.rangeStart.getTime()) / 86_400_000);
		return Math.ceil(days / 7);
	}

	get days(): Date[] {
		const total = Math.round((this.rangeEnd.getTime() - this.rangeStart.getTime()) / 86_400_000);
		return Array.from({ length: total }, (_, i) => addDays(this.rangeStart, i));
	}

	get title(): string {
		if (this.mode === 'day') return titleDay.format(this.anchor);
		if (this.mode === 'month') return titleMonth.format(this.anchor);
		const end = addDays(this.rangeStart, 6);
		return `${titleRange.format(this.rangeStart)} – ${titleRange.format(end)}, ${end.getFullYear()}`;
	}

	get isCurrentPeriod(): boolean {
		const now = new Date();
		return now >= this.rangeStart && now < this.rangeEnd;
	}

	inCurrentMonth(day: Date): boolean {
		return day.getMonth() === this.anchor.getMonth();
	}

	// --- navigation --------------------------------------------------------------------

	setMode(mode: CalendarViewMode) {
		if (this.mode === mode) return;
		this.mode = mode;
		void this.load();
	}

	shift(direction: 1 | -1) {
		if (this.mode === 'month') {
			this.anchor = new Date(this.anchor.getFullYear(), this.anchor.getMonth() + direction, 1);
		} else {
			this.anchor = addDays(this.anchor, direction * (this.mode === 'week' ? 7 : 1));
		}
		void this.load();
	}

	goToday() {
		this.anchor = startOfDay(new Date());
		void this.load();
	}

	/** Clicking a day in the month grid drills into it. */
	openDay(day: Date) {
		this.anchor = startOfDay(day);
		this.mode = 'day';
		void this.load();
	}

	// --- data --------------------------------------------------------------------------

	async load() {
		// Only the newest request may write to state: navigating quickly fires several, and a
		// slow earlier one landing last would show the wrong range.
		const id = ++this.requestId;
		this.loading = true;
		try {
			const events = await calendarApi.listEvents({
				from: this.rangeStart.toISOString(),
				to: this.rangeEnd.toISOString(),
				visibleOnly: true,
			});
			if (id !== this.requestId) return;
			this.events = events;
			this.error = null;
		} catch (e) {
			if (id !== this.requestId) return;
			this.error = e instanceof Error ? e.message : 'Failed to load events';
		} finally {
			if (id === this.requestId) this.loading = false;
		}
	}

	async reloadCalendars() {
		try {
			this.calendars = await calendarApi.listCalendars();
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to load calendars';
		}
	}

	/** Hiding a calendar is a server-side preference, so every device agrees on it. */
	async toggleCalendarVisible(calendar: Calendar) {
		const next = !calendar.visible;
		try {
			const updated = await calendarApi.updateCalendar(calendar.id, { visible: next });
			this.calendars = this.calendars.map((c) => (c.id === updated.id ? updated : c));
			await this.load();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to update calendar', 'error');
		}
	}

	async toggleCalendarSync(calendar: Calendar) {
		const next = !calendar.sync_enabled;
		try {
			const updated = await calendarApi.updateCalendar(calendar.id, { sync_enabled: next });
			this.calendars = this.calendars.map((c) => (c.id === updated.id ? updated : c));
			if (next) await calendarApi.sync(calendar.id);
			await this.load();
			addToast(next ? `Syncing ${updated.summary}` : `Stopped syncing ${updated.summary}`);
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to update calendar', 'error');
		}
	}

	async syncNow() {
		try {
			const result = await calendarApi.sync();
			await this.load();
			if (result.errors.length) {
				addToast(result.errors[0], 'error');
				return;
			}
			addToast(
				result.upserted || result.deleted
					? `Synced: ${result.upserted} updated, ${result.deleted} removed`
					: 'Already up to date'
			);
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Sync failed', 'error');
		}
	}

	// --- live updates ------------------------------------------------------------------

	/**
	 * Subscribes to the change stream, through this app's own server: the API takes a bearer
	 * token and EventSource cannot send headers, so /api/calendar/stream proxies it with the
	 * session's token attached.
	 *
	 * The stream only says *that* something changed; the range is refetched, which keeps one
	 * code path for a fresh page and a live update.
	 */
	connect(): () => void {
		if (typeof EventSource === 'undefined') return () => {};
		this.stream = new EventSource('/api/calendar/stream');
		this.stream.addEventListener('open', () => {
			this.live = true;
		});
		this.stream.addEventListener('error', () => {
			// EventSource reconnects on its own; the flag just stops the UI claiming to be live.
			this.live = false;
		});
		const onChange = () => this.scheduleRefresh();
		this.stream.addEventListener('calendar.changed', onChange);
		this.stream.addEventListener('account.connected', () => {
			void this.reloadCalendars();
			this.scheduleRefresh();
		});
		this.stream.addEventListener('account.disconnected', () => {
			void this.reloadCalendars();
			this.scheduleRefresh();
		});
		this.stream.addEventListener('account.needs_reauth', () => {
			void this.reloadCalendars();
			addToast('A Google account needs to be reconnected', 'error');
		});
		return () => this.disconnect();
	}

	disconnect() {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.refreshTimer = null;
		this.stream?.close();
		this.stream = null;
		this.live = false;
	}

	/** One notification per change is the ideal; a burst is normal. Coalesce them. */
	private scheduleRefresh() {
		if (this.refreshTimer) clearTimeout(this.refreshTimer);
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = null;
			void this.load();
		}, 400);
	}

	// --- queries used by the views -----------------------------------------------------

	eventsOn(day: Date): CalendarEvent[] {
		return this.events.filter((e) => occupiesDay(e, day));
	}

	allDayOn(day: Date): CalendarEvent[] {
		return this.eventsOn(day).filter((e) => e.all_day);
	}

	timedOn(day: Date): CalendarEvent[] {
		return this.eventsOn(day)
			.filter((e) => !e.all_day)
			.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
	}

	get writableCalendars(): Calendar[] {
		return this.calendars.filter((c) => c.writable && !c.deleted && c.sync_enabled);
	}

	get defaultCalendarId(): number | undefined {
		const primary = this.writableCalendars.find((c) => c.is_primary);
		return (primary ?? this.writableCalendars[0])?.id;
	}

	calendarById(id: number): Calendar | undefined {
		return this.calendars.find((c) => c.id === id);
	}

	/** Accounts in the order their calendars should be grouped, for the sidebar. */
	get calendarsByAccount(): { email: string; status: string; calendars: Calendar[] }[] {
		const groups = new Map<string, { email: string; status: string; calendars: Calendar[] }>();
		for (const c of this.calendars) {
			const group = groups.get(c.account_email) ?? {
				email: c.account_email,
				status: c.account_status,
				calendars: [],
			};
			group.calendars.push(c);
			groups.set(c.account_email, group);
		}
		return [...groups.values()];
	}
}
