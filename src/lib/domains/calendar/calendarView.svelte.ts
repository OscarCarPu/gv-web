import { calendarApi } from './api/calendar.api';
import type {
	CalendarEvent,
	CalendarItem,
	CalendarSource,
	CalendarViewMode,
} from './types/Calendar.types';
import { toLocalDateString } from '$lib/shared/utils/datetime';
import { planApi } from '$lib/domains/tasks/api/plan.api';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
import { capacityApi } from '$lib/domains/capacity/api/capacity.api';
import type { DayFreeBusy } from '$lib/domains/capacity/types/Capacity.types';

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

/** An item occupies a day when it overlaps that day at all; the end is exclusive. */
export function occupiesDay(item: { start: string; end: string }, day: Date): boolean {
	const dayStart = startOfDay(day).getTime();
	const dayEnd = addDays(startOfDay(day), 1).getTime();
	const start = new Date(item.start).getTime();
	const end = new Date(item.end).getTime();
	if (end === start) return start >= dayStart && start < dayEnd;
	return start < dayEnd && end > dayStart;
}

const SOURCE_KEY = 'calendar.source';

function storedSource(): CalendarSource {
	try {
		const value = localStorage.getItem(SOURCE_KEY);
		if (value === 'events' || value === 'plans' || value === 'both') return value;
	} catch {
		// Storage can be blocked; the default is fine.
	}
	return 'both';
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
 * CalendarView owns everything the calendar page shows: which range is on screen, the events and
 * plan blocks in it, and which of the two are drawn.
 *
 * An event with a plan block linked to it is one thing, not two: when both sources are shown it
 * appears once, as the plan block (which carries the task and the hours actually planned).
 */
export class CalendarView {
	mode = $state<CalendarViewMode>('month');
	/** Any instant inside the visible range; the range is derived from it and the mode. */
	anchor = $state<Date>(startOfDay(new Date()));
	events = $state<CalendarEvent[]>([]);
	planBlocks = $state<PlanBlockResponse[]>([]);
	freeBusy = $state<DayFreeBusy[]>([]);
	source = $state<CalendarSource>('both');
	loading = $state(false);
	error = $state<string | null>(null);

	private requestId = 0;

	constructor(
		events: CalendarEvent[],
		mode: CalendarViewMode = 'month',
		planBlocks: PlanBlockResponse[] = [],
		freeBusy: DayFreeBusy[] = []
	) {
		this.events = events;
		this.mode = mode;
		this.planBlocks = planBlocks;
		this.freeBusy = freeBusy;
	}

	/** Restores the saved source on the client; the server render always uses the default. */
	restoreSource() {
		this.source = storedSource();
	}

	setSource(source: CalendarSource) {
		this.source = source;
		try {
			localStorage.setItem(SOURCE_KEY, source);
		} catch {
			// Not persisted; still applied.
		}
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
			const today = startOfDay(new Date());
			const [events, range, freeBusy] = await Promise.all([
				calendarApi.listEvents({
					from: this.rangeStart.toISOString(),
					to: this.rangeEnd.toISOString(),
				}),
				planApi.getRange(toLocalDateString(this.rangeStart), toLocalDateString(this.rangeEnd)),
				capacityApi.getFreeBusy(toLocalDateString(today), toLocalDateString(addDays(today, 7))),
			]);
			if (id !== this.requestId) return;
			this.events = events;
			this.planBlocks = range.blocks;
			this.freeBusy = freeBusy.days;
			this.error = null;
		} catch (e) {
			if (id !== this.requestId) return;
			this.error = e instanceof Error ? e.message : 'Failed to load events';
		} finally {
			if (id === this.requestId) this.loading = false;
		}
	}

	/** Every chip asks, so the linked refs are indexed once per load rather than scanned. */
	#plannedRefs = $derived(
		new Set(this.planBlocks.flatMap((b) => (b.event_ref ? [b.event_ref] : [])))
	);

	/** Whether an event already has a plan block linked to it. */
	hasPlan(eventId: number): boolean {
		return this.#plannedRefs.has(String(eventId));
	}

	/** What the grids draw, according to the selected source. */
	items = $derived.by((): CalendarItem[] => {
		const showEvents = this.source !== 'plans';
		const showPlans = this.source !== 'events';
		const items: CalendarItem[] = [];

		for (const event of this.events) {
			const planned = this.hasPlan(event.id);
			// With both sources on, a planned event is drawn by its plan block instead.
			if (!showEvents || (showPlans && planned)) continue;
			items.push({
				key: `event-${event.id}`,
				kind: 'event',
				title: event.name,
				start: event.start_time,
				end: event.end_time,
				event,
				planned,
				block: null,
			});
		}

		if (showPlans) {
			const byId = new Map(this.events.map((e) => [String(e.id), e]));
			for (const block of this.planBlocks) {
				items.push({
					key: `plan-${block.id}`,
					kind: 'plan',
					title: block.task_name || block.label,
					start: block.started_at,
					end: block.ended_at,
					event: block.event_ref ? (byId.get(block.event_ref) ?? null) : null,
					planned: false,
					block,
				});
			}
		}
		return items;
	});

	itemsOn(day: Date): CalendarItem[] {
		return this.items
			.filter((item) => occupiesDay(item, day))
			.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
	}
}
