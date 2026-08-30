import { describe, it, expect } from 'vitest';
import {
	groupTasksByUrgency,
	truncateDueSoonGroups,
	buildUrgencyPhrase,
	type DueSoonGroup,
} from '$lib/domains/tasks/utils/dueSoonGrouping';
import type { TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';

const TODAY = '2026-08-29';

function makeTask(over: Partial<TaskByDueDateResponse> = {}): TaskByDueDateResponse {
	return {
		id: 1,
		name: 'Task',
		description: null,
		due_at: null,
		started_at: null,
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		time_spent: 0,
		estimate_hours: null,
		remaining_hours: null,
		start_by: null,
		urgent: false,
		project_id: null,
		project_name: null,
		project_due_at: null,
		depends_on: [],
		blocks: [],
		blocked: false,
		...over,
	};
}

function tiersOf(groups: DueSoonGroup[]): Record<string, number[]> {
	return Object.fromEntries(groups.map((g) => [g.tier, g.tasks.map((t) => t.id)]));
}

describe('groupTasksByUrgency', () => {
	it('puts a past-due task in overdue regardless of urgent', () => {
		const t = makeTask({ id: 1, due_at: '2026-08-20T00:00:00Z', urgent: false });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).overdue).toEqual([1]);
	});

	it('puts an urgent, not-yet-overdue task in today', () => {
		const t = makeTask({ id: 1, due_at: '2026-08-30T00:00:00Z', urgent: true, start_by: TODAY });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).today).toEqual([1]);
	});

	it('puts a non-urgent task due within 7 days in week', () => {
		const t = makeTask({ id: 1, due_at: '2026-09-03T00:00:00Z', urgent: false });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).week).toEqual([1]);
	});

	it('puts a non-urgent task due beyond 7 days in later', () => {
		const t = makeTask({ id: 1, due_at: '2026-09-28T00:00:00Z', urgent: false });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).later).toEqual([1]);
	});

	it('a task without an estimate never lands in today, and uses due_at as its effective date', () => {
		// No estimate_hours means no start_by, so urgent stays false regardless of how close
		// due_at is — this must behave exactly like plain due-date sorting, never promoted.
		const t = makeTask({ id: 1, due_at: '2026-08-30T00:00:00Z', urgent: false, start_by: null });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).week).toEqual([1]);
		expect(tiersOf(groups).today).toEqual([]);
	});

	it('a task with neither due_at nor project_due_at still appears, sorted last within later', () => {
		const dated = makeTask({ id: 1, due_at: '2026-09-28T00:00:00Z' });
		const undated = makeTask({ id: 2, due_at: null, project_due_at: null });
		const groups = groupTasksByUrgency([undated, dated], TODAY);
		expect(tiersOf(groups).later).toEqual([1, 2]);
	});

	it('sorts overdue/today by actual due date, priority breaking ties', () => {
		const a = makeTask({ id: 1, due_at: '2026-08-30T00:00:00Z', urgent: true, priority: 3 });
		const b = makeTask({ id: 2, due_at: '2026-08-30T00:00:00Z', urgent: true, priority: 1 });
		const c = makeTask({ id: 3, due_at: '2026-08-31T00:00:00Z', urgent: true, priority: 1 });
		const groups = groupTasksByUrgency([a, b, c], TODAY);
		expect(tiersOf(groups).today).toEqual([2, 1, 3]);
	});

	it('sorts week/later by effective date (start_by over due_at), priority breaking ties', () => {
		// Same due date, but "a" must start sooner (start_by) than "b" — it should sort first
		// even though its raw due_at is identical, which plain date sorting would have missed.
		const a = makeTask({
			id: 1,
			due_at: '2026-09-20T00:00:00Z',
			start_by: '2026-09-10',
			priority: 3,
		});
		const b = makeTask({
			id: 2,
			due_at: '2026-09-20T00:00:00Z',
			start_by: '2026-09-15',
			priority: 3,
		});
		const groups = groupTasksByUrgency([b, a], TODAY);
		expect(tiersOf(groups).later).toEqual([1, 2]);
	});
});

describe('truncateDueSoonGroups', () => {
	const groups: DueSoonGroup[] = [
		{ tier: 'overdue', label: 'Overdue', tasks: [makeTask({ id: 1 }), makeTask({ id: 2 })] },
		{ tier: 'today', label: 'Start Today', tasks: [makeTask({ id: 3 })] },
		{ tier: 'week', label: 'This Week', tasks: [] },
		{
			tier: 'later',
			label: 'Later',
			tasks: [makeTask({ id: 4 }), makeTask({ id: 5 }), makeTask({ id: 6 })],
		},
	];

	it('takes tasks in tier order up to the budget, dropping emptied and empty tiers', () => {
		const result = truncateDueSoonGroups(groups, 4);
		expect(tiersOf(result)).toEqual({
			overdue: [1, 2],
			today: [3],
			later: [4],
		});
	});

	it('keeps everything when the budget covers the whole list', () => {
		const result = truncateDueSoonGroups(groups, 100);
		expect(tiersOf(result)).toEqual({
			overdue: [1, 2],
			today: [3],
			later: [4, 5, 6],
		});
	});

	it('returns nothing when the budget is zero', () => {
		expect(truncateDueSoonGroups(groups, 0)).toEqual([]);
	});
});

describe('buildUrgencyPhrase', () => {
	it('returns null when the task is not urgent', () => {
		const t = makeTask({ urgent: false, remaining_hours: '5', start_by: TODAY });
		expect(buildUrgencyPhrase(t, TODAY)).toBeNull();
	});

	it('returns null when there is no estimate data to explain', () => {
		const t = makeTask({ urgent: true, remaining_hours: null, start_by: TODAY });
		expect(buildUrgencyPhrase(t, TODAY)).toBeNull();
	});

	it('says "start today" when start_by is today', () => {
		const t = makeTask({ urgent: true, remaining_hours: '6', start_by: TODAY });
		expect(buildUrgencyPhrase(t, TODAY)).toBe('6h left · start today');
	});

	it('says "should\'ve started yesterday" for exactly one day late', () => {
		const t = makeTask({ urgent: true, remaining_hours: '2.5', start_by: '2026-08-28' });
		expect(buildUrgencyPhrase(t, TODAY)).toBe("2.5h left · should've started yesterday");
	});

	it('says "should\'ve started Nd ago" for multiple days late', () => {
		const t = makeTask({ urgent: true, remaining_hours: '10', start_by: '2026-08-25' });
		expect(buildUrgencyPhrase(t, TODAY)).toBe("10h left · should've started 4d ago");
	});
});
