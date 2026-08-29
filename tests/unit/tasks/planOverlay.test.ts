import { describe, it, expect } from 'vitest';
import {
	buildPlanTimeline,
	blockSeconds,
	type PlanActualItem,
	type PlanGapItem,
	type PlanPlannedItem,
	type PlanSkippedItem,
} from '$lib/domains/tasks/utils/planOverlay';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

/** All fixtures live on one local day so the local-midnight clamp is exercised realistically. */
const DAY = { y: 2026, m: 6, d: 15 }; // 15 July 2026, local

function at(hour: number, minute = 0): Date {
	return new Date(DAY.y, DAY.m, DAY.d, hour, minute, 0, 0);
}

function iso(hour: number, minute = 0): string {
	return at(hour, minute).toISOString();
}

let blockId = 0;
function block(over: Partial<PlanBlockResponse> = {}): PlanBlockResponse {
	return {
		id: ++blockId,
		plan_date: iso(0),
		started_at: iso(9),
		ended_at: iso(10),
		task_id: 100,
		task_name: 'Refactor API',
		label: 'Refactor API',
		note: null,
		event_ref: null,
		commitment_id: null,
		task_type: 'standard',
		task_recurrence: null,
		task_started_at: null,
		task_finished_at: null,
		...over,
	};
}

let entryId = 0;
function entry(over: Partial<TimeEntryWithTask> = {}): TimeEntryWithTask {
	return {
		id: ++entryId,
		task_id: 100,
		task_name: 'Refactor API',
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		project_id: null,
		project_name: null,
		started_at: iso(9),
		finished_at: iso(10),
		comment: null,
		task_finished_at: null,
		time_spent: 3600,
		...over,
	};
}

const kinds = (items: { kind: string }[]) => items.map((i) => i.kind);

describe('blockSeconds', () => {
	it('measures a block in seconds and never goes negative', () => {
		expect(blockSeconds(block({ started_at: iso(9), ended_at: iso(10, 30) }))).toBe(5400);
		expect(blockSeconds(block({ started_at: iso(10), ended_at: iso(9) }))).toBe(0);
	});
});

describe('buildPlanTimeline', () => {
	it('emits only the now marker for an empty day', () => {
		const timeline = buildPlanTimeline({ blocks: [], entries: [], nowMs: at(12).getTime() });
		expect(kinds(timeline.items)).toEqual(['now']);
		expect(timeline.totals.doneSeconds).toBe(0);
	});

	it('runs one agenda around now: what happened, then what is left', () => {
		const timeline = buildPlanTimeline({
			blocks: [
				block({ started_at: iso(9), ended_at: iso(10), task_id: 100 }),
				block({ started_at: iso(14), ended_at: iso(15), task_id: 200, task_name: 'Deploy' }),
			],
			entries: [entry({ task_id: 100, started_at: iso(9), finished_at: iso(10) })],
			nowMs: at(11).getTime(),
		});

		expect(kinds(timeline.items)).toEqual(['actual', 'gap', 'now', 'planned']);
	});

	it('attributes an entry to the same-task block it overlaps most', () => {
		const early = block({ started_at: iso(9), ended_at: iso(9, 30), task_id: 100 });
		const late = block({ started_at: iso(10), ended_at: iso(11), task_id: 100 });

		const timeline = buildPlanTimeline({
			blocks: [early, late],
			entries: [entry({ task_id: 100, started_at: iso(10, 5), finished_at: iso(10, 55) })],
			nowMs: at(12).getTime(),
		});

		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.block?.id).toBe(late.id);
		expect(actual.plannedSeconds).toBe(3600);
		expect(actual.seconds).toBe(50 * 60);
	});

	it('still shows work on a task the plan never mentions, attributed to nothing', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(9), ended_at: iso(10), task_id: 100 })],
			// Same clock window, different task — the plan never asked for this.
			entries: [
				entry({ task_id: 999, task_name: 'Fix CI', started_at: iso(9), finished_at: iso(9, 33) }),
			],
			nowMs: at(12).getTime(),
		});

		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.block).toBeNull();
		expect(actual.offScheduleBlock).toBeNull();
		expect(actual.taskName).toBe('Fix CI');
		// It still happened, so it still counts toward the day.
		expect(timeline.totals.doneSeconds).toBe(33 * 60);
	});

	it('names the slot when planned work happened outside it', () => {
		const slot = block({ started_at: iso(14), ended_at: iso(16), task_id: 100 });
		const timeline = buildPlanTimeline({
			// Planned for 14:00, actually worked 07:00–09:00.
			blocks: [slot],
			entries: [entry({ task_id: 100, started_at: iso(7), finished_at: iso(9) })],
			nowMs: at(12).getTime(),
		});

		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.block).toBeNull();
		expect(actual.offScheduleBlock?.id).toBe(slot.id);
		expect(timeline.totals.offScheduleSeconds).toBe(2 * 3600);
	});

	it('reads a past block whose task moved as "done at another time", not skipped', () => {
		const timeline = buildPlanTimeline({
			// Planned 10:00–11:00 but actually worked 07:00–08:00.
			blocks: [block({ started_at: iso(10), ended_at: iso(11), task_id: 100 })],
			entries: [entry({ task_id: 100, started_at: iso(7), finished_at: iso(8) })],
			nowMs: at(12).getTime(),
		});

		const skipped = timeline.items.find((i) => i.kind === 'skipped') as PlanSkippedItem;
		expect(skipped.movedElsewhere).toBe(true);
		// A moved task is not a shortfall against the day.
		expect(timeline.totals.skippedSeconds).toBe(0);
	});

	it('still counts a genuinely untouched block as skipped', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(10), ended_at: iso(11), task_id: 100 })],
			entries: [entry({ task_id: 555, started_at: iso(7), finished_at: iso(8) })],
			nowMs: at(12).getTime(),
		});

		const skipped = timeline.items.find((i) => i.kind === 'skipped') as PlanSkippedItem;
		expect(skipped.movedElsewhere).toBe(false);
		expect(timeline.totals.skippedSeconds).toBe(3600);
	});

	it('marks a fully-past task block with nothing logged as skipped', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(9), ended_at: iso(10), task_id: 100, label: 'Write docs' })],
			entries: [],
			nowMs: at(12).getTime(),
		});

		const skipped = timeline.items.find((i) => i.kind === 'skipped') as PlanSkippedItem;
		expect(skipped.block.label).toBe('Write docs');
		expect(skipped.workedThrough).toBe(false);
		expect(timeline.totals.skippedSeconds).toBe(3600);
	});

	it('does not mark the in-progress block as skipped', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(11), ended_at: iso(13), task_id: 100 })],
			entries: [],
			nowMs: at(12).getTime(),
		});

		expect(timeline.items.some((i) => i.kind === 'skipped')).toBe(false);
		const planned = timeline.items.find((i) => i.kind === 'planned') as PlanPlannedItem;
		expect(planned.current).toBe(true);
		// Only the hour still ahead counts as remaining.
		expect(planned.remainingSeconds).toBe(3600);
		expect(timeline.totals.remainingPlannedSeconds).toBe(3600);
	});

	it('treats an untouched past free block as rest, and a worked-through one as skipped', () => {
		const lunch = { started_at: iso(13), ended_at: iso(13, 30), task_id: null, label: 'Comer' };

		const rested = buildPlanTimeline({
			blocks: [block(lunch)],
			entries: [],
			nowMs: at(15).getTime(),
		});
		expect(kinds(rested.items)).toContain('rest');
		expect(rested.totals.restSeconds).toBe(1800);

		const worked = buildPlanTimeline({
			blocks: [block(lunch)],
			entries: [entry({ task_id: 777, started_at: iso(13, 10), finished_at: iso(13, 20) })],
			nowMs: at(15).getTime(),
		});
		const skipped = worked.items.find((i) => i.kind === 'skipped') as PlanSkippedItem;
		expect(skipped.workedThrough).toBe(true);
		// A break worked through is not a shortfall against the daily target.
		expect(worked.totals.skippedSeconds).toBe(0);
	});

	it('emits gaps over 2 minutes between real work, and a trailing gap up to now', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ task_id: 100, started_at: iso(9), finished_at: iso(9, 30) }),
				entry({ task_id: 100, started_at: iso(10), finished_at: iso(10, 30) }),
			],
			nowMs: at(11).getTime(),
		});

		const gaps = timeline.items.filter((i) => i.kind === 'gap') as PlanGapItem[];
		expect(gaps.map((g) => g.seconds)).toEqual([1800, 1800]);
		expect(timeline.totals.gapSeconds).toBe(3600);
	});

	it('ignores sub-threshold holes between entries', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ started_at: iso(9), finished_at: iso(9, 30) }),
				entry({ started_at: iso(9, 31), finished_at: iso(10) }),
			],
			nowMs: at(10).getTime(),
		});
		expect(timeline.items.some((i) => i.kind === 'gap')).toBe(false);
	});

	it('merges overlapping entries so no phantom gap appears between them', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ started_at: iso(9), finished_at: iso(10) }),
				entry({ started_at: iso(9, 30), finished_at: iso(9, 45) }),
			],
			nowMs: at(10).getTime(),
		});
		expect(timeline.items.filter((i) => i.kind === 'gap')).toHaveLength(0);
	});

	it('clamps a running entry to now and flags it', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(11), finished_at: null })],
			nowMs: at(11, 20).getTime(),
		});

		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.running).toBe(true);
		expect(actual.seconds).toBe(20 * 60);
		expect(new Date(actual.endedAt).getTime()).toBe(at(11, 20).getTime());
		// The clamped end is now, so there is nothing left to call a gap.
		expect(timeline.items.some((i) => i.kind === 'gap')).toBe(false);
	});

	it('clamps an entry that started yesterday to local midnight', () => {
		const yesterdayEvening = new Date(DAY.y, DAY.m, DAY.d - 1, 23, 0, 0);
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: yesterdayEvening.toISOString(), finished_at: iso(0, 30) })],
			nowMs: at(2).getTime(),
		});

		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.seconds).toBe(30 * 60);
		expect(new Date(actual.startedAt).getTime()).toBe(at(0).getTime());
	});

	it('drops entries that lie entirely in the future', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(14), finished_at: iso(15) })],
			nowMs: at(12).getTime(),
		});
		expect(timeline.items.some((i) => i.kind === 'actual')).toBe(false);
	});

	it('orders everything before now chronologically across item kinds', () => {
		const timeline = buildPlanTimeline({
			blocks: [
				block({ started_at: iso(9), ended_at: iso(10), task_id: 100 }), // worked
				block({ started_at: iso(10), ended_at: iso(11), task_id: 200, label: 'Write docs' }), // skipped
				block({ started_at: iso(11), ended_at: iso(11, 30), task_id: null, label: 'Comer' }), // rest
			],
			entries: [entry({ task_id: 100, started_at: iso(9), finished_at: iso(10) })],
			nowMs: at(11, 30).getTime(),
		});

		expect(kinds(timeline.items)).toEqual([
			'actual', // 09:00
			'skipped', // 10:00
			'rest', // 11:00
			'now',
		]);
		// The skipped hour is explained by its own row — no duplicate gap over the same minutes.
		expect(timeline.totals.gapSeconds).toBe(0);
	});

	it('does not emit a gap over minutes a skipped block already explains', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(10), ended_at: iso(11), task_id: 200 })],
			entries: [entry({ task_id: 100, started_at: iso(9), finished_at: iso(10) })],
			nowMs: at(11).getTime(),
		});

		expect(kinds(timeline.items)).toEqual(['actual', 'skipped', 'now']);
		expect(timeline.totals.gapSeconds).toBe(0);
		expect(timeline.totals.skippedSeconds).toBe(3600);
	});

	it('reports a partially-worked block as a shortfall rather than a skip', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(10), ended_at: iso(11), task_id: 100 })],
			entries: [entry({ task_id: 100, started_at: iso(10), finished_at: iso(10, 27) })],
			nowMs: at(12).getTime(),
		});

		expect(timeline.items.some((i) => i.kind === 'skipped')).toBe(false);
		const actual = timeline.items.find((i) => i.kind === 'actual') as PlanActualItem;
		expect(actual.seconds).toBe(27 * 60);
		expect(actual.plannedSeconds).toBe(3600);
		expect(timeline.totals.doneSeconds).toBe(27 * 60);
	});

	it('counts only task blocks toward remaining planned time', () => {
		const timeline = buildPlanTimeline({
			blocks: [
				block({ started_at: iso(14), ended_at: iso(15), task_id: 100 }),
				block({ started_at: iso(15), ended_at: iso(16), task_id: null, label: 'Comer' }),
			],
			entries: [],
			nowMs: at(12).getTime(),
		});
		expect(timeline.totals.remainingPlannedSeconds).toBe(3600);
	});
});
