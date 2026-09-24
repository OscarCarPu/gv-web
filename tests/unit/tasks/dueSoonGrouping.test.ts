import { describe, it, expect } from 'vitest';
import {
	groupTasksByUrgency,
	priorityOf,
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
		finish_by: null,
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
	it('breaks a start_by tie by the sooner deadline, so a chain keeps its order', () => {
		const second = makeTask({ id: 1, start_by: '2026-09-05', finish_by: '2026-09-06' });
		const first = makeTask({ id: 2, start_by: '2026-09-05', finish_by: '2026-09-05' });
		expect(tiersOf(groupTasksByUrgency([second, first], TODAY)).week).toEqual([2, 1]);
	});

	it('orders a tier by priority first, then by date', () => {
		const p3Soon = makeTask({ id: 1, priority: 3, start_by: '2026-08-30' });
		const p2Later = makeTask({ id: 2, priority: 2, start_by: '2026-09-03' });
		const p2Soon = makeTask({ id: 3, priority: 2, start_by: '2026-08-31' });
		const p1Last = makeTask({ id: 4, priority: 1, start_by: '2026-09-04' });
		expect(tiersOf(groupTasksByUrgency([p3Soon, p2Later, p2Soon, p1Last], TODAY)).week).toEqual([
			4, 3, 2, 1,
		]);
	});

	it('orders by the priority a task is worked on by, inherited from what it blocks', () => {
		const study = makeTask({ id: 1, priority: 3, effective_priority: 2, start_by: '2026-09-05' });
		const chore = makeTask({ id: 2, priority: 3, start_by: '2026-09-01' });
		expect(priorityOf(study)).toBe(2);
		expect(tiersOf(groupTasksByUrgency([chore, study], TODAY)).week).toEqual([1, 2]);
	});

	it('uses finish_by over the inherited due date: a chain step past its own deadline is overdue', () => {
		const t = makeTask({ id: 1, due_at: '2026-09-01T00:00:00Z', finish_by: '2026-08-28' });
		expect(tiersOf(groupTasksByUrgency([t], TODAY)).overdue).toEqual([1]);
	});

	it('puts a chain step whose finish_by is today in today', () => {
		const t = makeTask({ id: 1, due_at: '2026-09-01T00:00:00Z', finish_by: TODAY });
		expect(tiersOf(groupTasksByUrgency([t], TODAY)).today).toEqual([1]);
	});

	it('sorts overdue by finish_by, not the shared inherited due date', () => {
		const later = makeTask({ id: 1, due_at: '2026-09-01T00:00:00Z', finish_by: '2026-08-27' });
		const sooner = makeTask({ id: 2, due_at: '2026-09-01T00:00:00Z', finish_by: '2026-08-25' });
		expect(tiersOf(groupTasksByUrgency([later, sooner], TODAY)).overdue).toEqual([2, 1]);
	});

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

	it('a task without an estimate due tomorrow never lands in today, and uses due_at as its effective date', () => {
		// No estimate_hours means no start_by, so urgent stays false regardless of how close
		// due_at is — this must behave exactly like plain due-date sorting, never promoted early.
		const t = makeTask({ id: 1, due_at: '2026-08-30T00:00:00Z', urgent: false, start_by: null });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).week).toEqual([1]);
		expect(tiersOf(groups).today).toEqual([]);
	});

	it('a task without an estimate due today still lands in today', () => {
		// Due today is due today regardless of whether the task carries an estimate — only the
		// early (pre-due-date) promotion depends on urgent/start_by.
		const t = makeTask({ id: 1, due_at: `${TODAY}T00:00:00Z`, urgent: false, start_by: null });
		const groups = groupTasksByUrgency([t], TODAY);
		expect(tiersOf(groups).today).toEqual([1]);
		expect(tiersOf(groups).week).toEqual([]);
	});

	it('a task with neither due_at nor project_due_at still appears, sorted last within later', () => {
		const dated = makeTask({ id: 1, due_at: '2026-09-28T00:00:00Z' });
		const undated = makeTask({ id: 2, due_at: null, project_due_at: null });
		const groups = groupTasksByUrgency([undated, dated], TODAY);
		expect(tiersOf(groups).later).toEqual([1, 2]);
	});

	it('sorts overdue/today by priority, then actual due date', () => {
		const a = makeTask({ id: 1, due_at: '2026-08-30T00:00:00Z', urgent: true, priority: 3 });
		const b = makeTask({ id: 2, due_at: '2026-08-30T00:00:00Z', urgent: true, priority: 1 });
		const c = makeTask({ id: 3, due_at: '2026-08-31T00:00:00Z', urgent: true, priority: 1 });
		const groups = groupTasksByUrgency([a, b, c], TODAY);
		expect(tiersOf(groups).today).toEqual([2, 3, 1]);
	});

	it('sorts week/later within a priority by effective date (start_by over due_at)', () => {
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
