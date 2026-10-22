import { describe, it, expect, vi } from 'vitest';
import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

vi.mock('$lib/domains/calendar/api/calendar.api', () => ({ calendarApi: {} }));
vi.mock('$lib/domains/tasks/api/plan.api', () => ({ planApi: {} }));
vi.mock('$lib/domains/capacity/api/capacity.api', () => ({ capacityApi: {} }));

import { CalendarView, occupiesDay } from '$lib/domains/calendar/calendarView.svelte';

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 1,
		name: 'Dentist',
		start_time: '2026-08-20T07:00:00Z',
		end_time: '2026-08-20T08:00:00Z',
		...over,
	};
}

function block(over: Partial<PlanBlockResponse> = {}): PlanBlockResponse {
	return {
		id: 10,
		plan_date: '2026-08-20',
		started_at: '2026-08-20T07:00:00Z',
		ended_at: '2026-08-20T08:00:00Z',
		task_id: null,
		task_name: null,
		label: 'Focus',
		note: null,
		event_ref: null,
		commitment_id: null,
		...over,
	};
}

const day = new Date(2026, 7, 20);

describe('occupiesDay', () => {
	it('covers every day a multi-day item touches, with an exclusive end', () => {
		const trip = {
			start: new Date(2026, 7, 19, 22).toISOString(),
			end: new Date(2026, 7, 21).toISOString(),
		};
		expect(occupiesDay(trip, new Date(2026, 7, 19))).toBe(true);
		expect(occupiesDay(trip, new Date(2026, 7, 20))).toBe(true);
		expect(occupiesDay(trip, new Date(2026, 7, 21))).toBe(false);
	});
});

describe('CalendarView items', () => {
	const events = [event({ id: 1 }), event({ id: 2, name: 'Lunch' })];
	const blocks = [
		block({ id: 10, event_ref: '1', task_name: 'Dentist prep' }),
		block({ id: 11, label: 'Free focus' }),
	];

	it('events only: shows events, none of the plan blocks', () => {
		const view = new CalendarView(events, 'month', blocks);
		view.source = 'events';
		expect(view.itemsOn(day).map((i) => i.key)).toEqual(['event-1', 'event-2']);
		expect(view.items.find((i) => i.key === 'event-1')?.planned).toBe(true);
	});

	it('plans only: shows every plan block, linked or not', () => {
		const view = new CalendarView(events, 'month', blocks);
		view.source = 'plans';
		expect(view.items.map((i) => i.key)).toEqual(['plan-10', 'plan-11']);
	});

	it('both: an event with a plan shows once, as its plan block', () => {
		const view = new CalendarView(events, 'month', blocks);
		view.source = 'both';
		const keys = view.items.map((i) => i.key);
		expect(keys).toEqual(['event-2', 'plan-10', 'plan-11']);
		expect(view.items.find((i) => i.key === 'plan-10')?.event?.id).toBe(1);
	});

	it('a plan block opens the event it is linked to, and nothing when unlinked', () => {
		const view = new CalendarView(events, 'month', blocks);
		view.source = 'plans';
		expect(view.items.find((i) => i.key === 'plan-10')?.event?.name).toBe('Dentist');
		expect(view.items.find((i) => i.key === 'plan-11')?.event).toBeNull();
	});

	it('names a plan block after its task, else its label', () => {
		const view = new CalendarView([], 'month', blocks);
		view.source = 'plans';
		expect(view.items.map((i) => i.title)).toEqual(['Dentist prep', 'Free focus']);
	});
});
