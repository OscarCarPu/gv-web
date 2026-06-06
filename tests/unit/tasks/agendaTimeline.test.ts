import { describe, it, expect } from 'vitest';
import { buildAgendaItems } from '$lib/domains/tasks/utils/agendaTimeline';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

function makeEntry(over: Partial<TimeEntryWithTask> = {}): TimeEntryWithTask {
	return {
		id: 1,
		task_id: 1,
		task_name: 'Task',
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		project_id: null,
		project_name: null,
		started_at: '2026-03-10T10:00:00.000Z',
		finished_at: '2026-03-10T11:00:00.000Z',
		comment: null,
		task_finished_at: null,
		time_spent: 3600,
		...over,
	};
}

describe('buildAgendaItems', () => {
	it('returns an empty array for empty input', () => {
		expect(buildAgendaItems([])).toEqual([]);
	});

	it('emits a single entry item (with hour label) for one entry', () => {
		const d = new Date(2026, 2, 10, 10, 0, 0); // local 10:00
		const items = buildAgendaItems([makeEntry({ id: 5, started_at: d.toISOString() })]);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ type: 'entry', hourLabel: '10:00' });
		expect(items[0].type === 'entry' && items[0].entry.id).toBe(5);
	});

	it('inserts a day divider across a midnight boundary', () => {
		// Two entries on consecutive local days, back-to-back (< 120s gaps) so no gap items.
		const day1Start = new Date(2026, 2, 10, 23, 59, 0); // local
		const day1End = new Date(2026, 2, 10, 23, 59, 30);
		const day2Start = new Date(2026, 2, 11, 0, 0, 30); // 30s after midnight

		const items = buildAgendaItems([
			makeEntry({
				id: 1,
				started_at: day1Start.toISOString(),
				finished_at: day1End.toISOString(),
			}),
			makeEntry({
				id: 2,
				started_at: day2Start.toISOString(),
				finished_at: new Date(2026, 2, 11, 0, 1, 0).toISOString(),
			}),
		]);

		// Reversed (most-recent-first): [entry day2, day divider, entry day1]
		const types = items.map((i) => i.type);
		expect(types).toEqual(['entry', 'day', 'entry']);

		const divider = items.find((i) => i.type === 'day');
		expect(divider?.type === 'day' && divider.label).toContain('11/3');
	});

	it('splits a >120s gap across the day boundary into before/after gaps', () => {
		// Day 1 ends well before midnight; day 2 starts well after midnight.
		const day1Start = new Date(2026, 2, 10, 22, 0, 0);
		const day1End = new Date(2026, 2, 10, 23, 0, 0); // 1h before midnight
		const day2Start = new Date(2026, 2, 11, 1, 0, 0); // 1h after midnight

		const items = buildAgendaItems([
			makeEntry({
				id: 1,
				started_at: day1Start.toISOString(),
				finished_at: day1End.toISOString(),
			}),
			makeEntry({
				id: 2,
				started_at: day2Start.toISOString(),
				finished_at: new Date(2026, 2, 11, 2, 0, 0).toISOString(),
			}),
		]);

		// Ascending build: [entry1, gapBefore, day, gapAfter, entry2] → reversed for display.
		const types = items.map((i) => i.type);
		expect(types).toEqual(['entry', 'gap', 'day', 'gap', 'entry']);

		const gaps = items.filter((i) => i.type === 'gap');
		expect(gaps).toHaveLength(2);
		// Each gap is one hour (3600s): midnight − prevEnd and thisStart − midnight.
		for (const g of gaps) {
			expect(g.type === 'gap' && g.duration).toBe(3600);
		}
	});

	it('emits a normal same-day gap when the gap exceeds 120s', () => {
		const first = makeEntry({
			id: 1,
			started_at: new Date(2026, 2, 10, 10, 0, 0).toISOString(),
			finished_at: new Date(2026, 2, 10, 10, 30, 0).toISOString(),
		});
		const second = makeEntry({
			id: 2,
			started_at: new Date(2026, 2, 10, 12, 0, 0).toISOString(), // 1.5h gap
			finished_at: new Date(2026, 2, 10, 12, 30, 0).toISOString(),
		});

		const items = buildAgendaItems([first, second]);
		const types = items.map((i) => i.type);
		// Reversed: [entry2, gap, entry1]
		expect(types).toEqual(['entry', 'gap', 'entry']);
	});
});
