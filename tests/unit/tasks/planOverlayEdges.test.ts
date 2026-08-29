/**
 * Adversarial edge cases for `buildPlanTimeline`. The happy paths live in planOverlay.test.ts;
 * this file tries to break the interval arithmetic — boundaries, zero-length spans, DST,
 * midnight, unsorted input, deleted tasks, and self-consistency of the totals.
 */
import { describe, it, expect } from 'vitest';
import {
	buildPlanTimeline,
	type PlanActualItem,
	type PlanGapItem,
	type PlanPlannedItem,
	type PlanSkippedItem,
	type PlanTimelineItem,
} from '$lib/domains/tasks/utils/planOverlay';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

const DAY = { y: 2026, m: 6, d: 15 };

function at(h: number, min = 0, s = 0): Date {
	return new Date(DAY.y, DAY.m, DAY.d, h, min, s, 0);
}
const iso = (h: number, min = 0, s = 0) => at(h, min, s).toISOString();

let bid = 0;
function block(over: Partial<PlanBlockResponse> = {}): PlanBlockResponse {
	return {
		id: ++bid,
		plan_date: iso(0),
		started_at: iso(9),
		ended_at: iso(10),
		task_id: 100,
		task_name: 'Task A',
		label: 'Task A',
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

let eid = 0;
function entry(over: Partial<TimeEntryWithTask> = {}): TimeEntryWithTask {
	return {
		id: ++eid,
		task_id: 100,
		task_name: 'Task A',
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

const kinds = (items: PlanTimelineItem[]) => items.map((i) => i.kind);
const actuals = (items: PlanTimelineItem[]) =>
	items.filter((i): i is PlanActualItem => i.kind === 'actual');

describe('buildPlanTimeline — boundaries', () => {
	it('does not attribute an entry that merely touches a block edge', () => {
		// Block 09:00–10:00, entry 10:00–11:00: they share an instant, not an interval.
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(9), ended_at: iso(10), task_id: 100 })],
			entries: [entry({ task_id: 100, started_at: iso(10), finished_at: iso(11) })],
			nowMs: at(12).getTime(),
		});

		const a = actuals(timeline.items)[0];
		expect(a.block).toBeNull();
		// Same task is planned today, so it reads off-schedule instead.
		expect(a.offScheduleBlock).not.toBeNull();
	});

	it('attributes an entry overlapping a block by a single second', () => {
		const b = block({ started_at: iso(9), ended_at: iso(10), task_id: 100 });
		const timeline = buildPlanTimeline({
			blocks: [b],
			entries: [entry({ task_id: 100, started_at: iso(9, 59, 59), finished_at: iso(11) })],
			nowMs: at(12).getTime(),
		});
		expect(actuals(timeline.items)[0].block?.id).toBe(b.id);
	});

	it('drops a zero-length entry instead of emitting an empty row', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(9), finished_at: iso(9) })],
			nowMs: at(12).getTime(),
		});
		expect(kinds(timeline.items)).toEqual(['now']);
		expect(timeline.totals.doneSeconds).toBe(0);
	});

	it('drops an entry whose finished_at precedes its started_at', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(11), finished_at: iso(9) })],
			nowMs: at(12).getTime(),
		});
		expect(actuals(timeline.items)).toHaveLength(0);
	});

	it('treats a block ending exactly at now as past, not future', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(11), ended_at: iso(12), task_id: 100 })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		expect(kinds(timeline.items)).toContain('skipped');
		expect(timeline.items.some((i) => i.kind === 'planned')).toBe(false);
	});

	it('treats a block starting exactly at now as future and not current', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(12), ended_at: iso(13), task_id: 100 })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		const p = timeline.items.find((i): i is PlanPlannedItem => i.kind === 'planned')!;
		expect(p.current).toBe(true); // start <= now < end
		expect(p.remainingSeconds).toBe(3600);
	});

	it('emits a gap of exactly the threshold as no gap, and one second more as a gap', () => {
		const exactly = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ started_at: iso(9), finished_at: iso(10) }),
				entry({ started_at: iso(10, 2), finished_at: iso(11) }),
			],
			nowMs: at(11).getTime(),
		});
		expect(exactly.items.some((i) => i.kind === 'gap')).toBe(false);

		const oneMore = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ started_at: iso(9), finished_at: iso(10) }),
				entry({ started_at: iso(10, 2, 1), finished_at: iso(11) }),
			],
			nowMs: at(11).getTime(),
		});
		expect(oneMore.items.some((i) => i.kind === 'gap')).toBe(true);
	});
});

describe('buildPlanTimeline — degenerate blocks and tasks', () => {
	it('handles a zero-length block without dividing by zero', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(9), ended_at: iso(9), task_id: 100 })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		const s = timeline.items.find((i): i is PlanSkippedItem => i.kind === 'skipped')!;
		expect(s.seconds).toBe(0);
		expect(Number.isFinite(timeline.totals.skippedSeconds)).toBe(true);
	});

	it('treats a block whose task was deleted (task_id null) as free time', () => {
		// ON DELETE SET NULL leaves the label behind — it must not be read as a task block.
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(9), ended_at: iso(10), task_id: null, label: 'Orphan' })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		expect(kinds(timeline.items)).toContain('rest');
		expect(timeline.totals.skippedSeconds).toBe(0);
		expect(timeline.totals.restSeconds).toBe(3600);
	});

	it('never counts a free block toward remaining planned time', () => {
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: iso(20), ended_at: iso(22), task_id: null, label: 'cena' })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		expect(timeline.totals.remainingPlannedSeconds).toBe(0);
	});

	it('ignores blocks from another day rather than mis-clamping them', () => {
		const tomorrow9 = new Date(DAY.y, DAY.m, DAY.d + 1, 9).toISOString();
		const tomorrow10 = new Date(DAY.y, DAY.m, DAY.d + 1, 10).toISOString();
		const timeline = buildPlanTimeline({
			blocks: [block({ started_at: tomorrow9, ended_at: tomorrow10, task_id: 100 })],
			entries: [],
			nowMs: at(12).getTime(),
		});
		// Future is future — it lands after the now marker, never before it.
		expect(kinds(timeline.items)).toEqual(['now', 'planned']);
	});
});

describe('buildPlanTimeline — multiple entries per block', () => {
	it('keeps every entry as its own row and marks the block fulfilled once', () => {
		const b = block({ started_at: iso(9), ended_at: iso(12), task_id: 100 });
		const timeline = buildPlanTimeline({
			blocks: [b],
			entries: [
				entry({ task_id: 100, started_at: iso(9), finished_at: iso(10) }),
				entry({ task_id: 100, started_at: iso(10, 30), finished_at: iso(11) }),
			],
			nowMs: at(12).getTime(),
		});

		const rows = actuals(timeline.items);
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.block?.id === b.id)).toBe(true);
		// Fulfilled by at least one entry, so it is not also reported as skipped.
		expect(timeline.items.some((i) => i.kind === 'skipped')).toBe(false);
		expect(timeline.totals.doneSeconds).toBe(90 * 60);
	});

	it('picks the block with the larger overlap when two same-task blocks compete', () => {
		const small = block({ started_at: iso(9), ended_at: iso(9, 20), task_id: 100 });
		const big = block({ started_at: iso(9, 20), ended_at: iso(11), task_id: 100 });
		const timeline = buildPlanTimeline({
			blocks: [small, big],
			entries: [entry({ task_id: 100, started_at: iso(9, 10), finished_at: iso(10) })],
			nowMs: at(12).getTime(),
		});
		// 10 min in `small`, 40 min in `big`.
		expect(actuals(timeline.items)[0].block?.id).toBe(big.id);
		// The unfulfilled competitor is still surfaced as skipped, not silently dropped.
		const skipped = timeline.items.filter((i): i is PlanSkippedItem => i.kind === 'skipped');
		expect(skipped.map((s) => s.block.id)).toEqual([small.id]);
	});

	it('sorts unsorted input chronologically', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ id: 3, started_at: iso(11), finished_at: iso(11, 30) }),
				entry({ id: 1, started_at: iso(9), finished_at: iso(9, 30) }),
				entry({ id: 2, started_at: iso(10), finished_at: iso(10, 30) }),
			],
			nowMs: at(12).getTime(),
		});
		const starts = actuals(timeline.items).map((a) => new Date(a.startedAt).getHours());
		expect(starts).toEqual([9, 10, 11]);
	});

	it('does not emit a gap between two entries that abut across a merge', () => {
		// A contains B entirely, then C starts right when A ends.
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({ started_at: iso(9), finished_at: iso(11) }),
				entry({ started_at: iso(9, 30), finished_at: iso(10) }),
				entry({ started_at: iso(11), finished_at: iso(12) }),
			],
			nowMs: at(12).getTime(),
		});
		expect(timeline.items.some((i) => i.kind === 'gap')).toBe(false);
		expect(timeline.totals.gapSeconds).toBe(0);
	});
});

describe('buildPlanTimeline — midnight and the running entry', () => {
	it('clamps an entry still running from yesterday to today only', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({
					started_at: new Date(DAY.y, DAY.m, DAY.d - 1, 22).toISOString(),
					finished_at: null,
				}),
			],
			nowMs: at(1).getTime(),
		});
		const a = actuals(timeline.items)[0];
		expect(a.running).toBe(true);
		// Midnight to 01:00, not the three hours since 22:00 yesterday.
		expect(a.seconds).toBe(3600);
		expect(timeline.totals.doneSeconds).toBe(3600);
	});

	it('shows a timer started after the last nowMs tick instead of dropping it', () => {
		// Regression: `nowMs` is re-ticked once a minute, so an entry created seconds ago sits
		// ahead of it. The clamped span went negative and the row vanished for up to a minute —
		// a timer you just started looked like it had not been recorded.
		const staleNow = at(12, 0, 0).getTime();
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(12, 0, 40), finished_at: null })],
			nowMs: staleNow,
		});

		const rows = actuals(timeline.items);
		expect(rows).toHaveLength(1);
		expect(rows[0].running).toBe(true);
		expect(rows[0].seconds).toBe(0);
		expect(timeline.totals.doneSeconds).toBe(0);
		// It must not fabricate a backwards interval.
		expect(new Date(rows[0].endedAt).getTime()).toBeGreaterThanOrEqual(
			new Date(rows[0].startedAt).getTime()
		);
	});

	it('keeps a short just-stopped entry once nowMs is current', () => {
		// Regression: pressing Stop a few seconds after Start produced a span entirely past the
		// last minute tick, so the row vanished the instant you stopped. The builder needs an
		// up-to-date `nowMs`, which `PlanSection` now re-ticks whenever the entry set changes.
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(12, 0, 30), finished_at: iso(12, 0, 34) })],
			nowMs: at(12, 0, 34).getTime(),
		});

		const rows = actuals(timeline.items);
		expect(rows).toHaveLength(1);
		expect(rows[0].running).toBe(false);
		expect(rows[0].seconds).toBe(4);
	});

	it('still drops a finished zero-length entry as data noise', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(9), finished_at: iso(9) })],
			nowMs: at(12).getTime(),
		});
		expect(actuals(timeline.items)).toHaveLength(0);
	});

	it('keeps a running entry attributed to its block despite a stale nowMs', () => {
		const b = block({ started_at: iso(11), ended_at: iso(13), task_id: 100 });
		const timeline = buildPlanTimeline({
			blocks: [b],
			entries: [entry({ task_id: 100, started_at: iso(12, 0, 30), finished_at: null })],
			nowMs: at(12, 0, 0).getTime(),
		});
		const a = actuals(timeline.items)[0];
		expect(a.block?.id).toBe(b.id);
		expect(a.offScheduleBlock).toBeNull();
	});

	it('produces no leading gap from midnight to the first entry', () => {
		// The day does not owe an explanation for the hours you were asleep.
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(9), finished_at: iso(10) })],
			nowMs: at(10).getTime(),
		});
		expect(timeline.items.some((i) => i.kind === 'gap')).toBe(false);
	});

	it('clamps a finished_at that lies in the future to now', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ started_at: iso(11), finished_at: iso(14) })],
			nowMs: at(12).getTime(),
		});
		const a = actuals(timeline.items)[0];
		expect(a.seconds).toBe(3600);
		expect(new Date(a.endedAt).getTime()).toBe(at(12).getTime());
		// Clamped end == now, so no trailing gap either.
		expect(timeline.items.some((i) => i.kind === 'gap')).toBe(false);
	});

	it('splits a block straddling now: past half as actual, remainder as planned', () => {
		const b = block({ started_at: iso(11), ended_at: iso(13), task_id: 100 });
		const timeline = buildPlanTimeline({
			blocks: [b],
			entries: [entry({ task_id: 100, started_at: iso(11), finished_at: null })],
			nowMs: at(12).getTime(),
		});

		const a = actuals(timeline.items)[0];
		const p = timeline.items.find((i): i is PlanPlannedItem => i.kind === 'planned')!;
		expect(a.block?.id).toBe(b.id);
		expect(a.seconds).toBe(3600); // 11:00 → now
		expect(p.remainingSeconds).toBe(3600); // now → 13:00
		expect(p.current).toBe(true);
		// Done + remaining must not double-count the block.
		expect(timeline.totals.doneSeconds + timeline.totals.remainingPlannedSeconds).toBe(7200);
	});
});

describe('buildPlanTimeline — DST', () => {
	// Europe/Madrid springs forward 29 March 2026 at 02:00 → 03:00.
	it('measures a block spanning the spring-forward jump in real elapsed time', () => {
		const start = new Date(2026, 2, 29, 1, 0).getTime();
		const end = new Date(2026, 2, 29, 4, 0).getTime();
		const realHours = (end - start) / 3_600_000;

		const timeline = buildPlanTimeline({
			blocks: [
				block({
					started_at: new Date(start).toISOString(),
					ended_at: new Date(end).toISOString(),
					task_id: 100,
				}),
			],
			entries: [
				entry({
					task_id: 100,
					started_at: new Date(start).toISOString(),
					finished_at: new Date(end).toISOString(),
				}),
			],
			nowMs: new Date(2026, 2, 29, 12, 0).getTime(),
		});

		// Whatever the local offset does, done-seconds tracks the wall-clock difference.
		expect(timeline.totals.doneSeconds).toBe(realHours * 3600);
		expect(actuals(timeline.items)[0].plannedSeconds).toBe(realHours * 3600);
	});

	it('measures a block spanning the autumn fall-back jump in real elapsed time', () => {
		// Europe/Madrid falls back 25 October 2026 at 03:00 → 02:00, so 01:00–04:00 is 4 hours.
		const start = new Date(2026, 9, 25, 1, 0).getTime();
		const end = new Date(2026, 9, 25, 4, 0).getTime();
		expect((end - start) / 3_600_000).toBe(4); // guard: the jump really is in this tz

		const timeline = buildPlanTimeline({
			blocks: [
				block({
					started_at: new Date(start).toISOString(),
					ended_at: new Date(end).toISOString(),
					task_id: 100,
				}),
			],
			entries: [
				entry({
					task_id: 100,
					started_at: new Date(start).toISOString(),
					finished_at: new Date(end).toISOString(),
				}),
			],
			nowMs: new Date(2026, 9, 25, 12, 0).getTime(),
		});

		// A naive (endHour - startHour) implementation would report 3h here.
		expect(timeline.totals.doneSeconds).toBe(4 * 3600);
	});

	it('uses local midnight of the DST day as the clamp origin', () => {
		const nowMs = new Date(2026, 2, 29, 12, 0).getTime();
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [
				entry({
					started_at: new Date(2026, 2, 28, 23, 0).toISOString(),
					finished_at: new Date(2026, 2, 29, 1, 0).toISOString(),
				}),
			],
			nowMs,
		});
		const a = actuals(timeline.items)[0];
		expect(new Date(a.startedAt).getTime()).toBe(new Date(2026, 2, 29, 0, 0).getTime());
	});
});

describe('buildPlanTimeline — invariants', () => {
	const scenario = {
		blocks: [
			block({ started_at: iso(9), ended_at: iso(10), task_id: 100 }),
			block({ started_at: iso(10), ended_at: iso(11), task_id: 200, label: 'B' }),
			block({ started_at: iso(11), ended_at: iso(11, 30), task_id: null, label: 'café' }),
			block({ started_at: iso(14), ended_at: iso(16), task_id: 300, label: 'C' }),
		],
		entries: [
			entry({ task_id: 100, started_at: iso(9), finished_at: iso(9, 40) }),
			entry({ task_id: 999, task_name: 'Fire', started_at: iso(12), finished_at: null }),
		],
		nowMs: at(12, 30).getTime(),
	};

	it('is deterministic and does not mutate its inputs', () => {
		const blocksBefore = JSON.stringify(scenario.blocks);
		const entriesBefore = JSON.stringify(scenario.entries);

		const a = buildPlanTimeline(scenario);
		const b = buildPlanTimeline(scenario);

		expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
		expect(a.totals).toEqual(b.totals);
		expect(JSON.stringify(scenario.blocks)).toBe(blocksBefore);
		expect(JSON.stringify(scenario.entries)).toBe(entriesBefore);
	});

	it('keeps doneSeconds equal to the sum of the actual rows it renders', () => {
		const { items, totals } = buildPlanTimeline(scenario);
		const summed = actuals(items).reduce((s, a) => s + a.seconds, 0);
		expect(summed).toBe(totals.doneSeconds);
	});

	it('keeps every total non-negative and finite', () => {
		const { totals } = buildPlanTimeline(scenario);
		for (const [key, value] of Object.entries(totals)) {
			expect(Number.isFinite(value), `${key} finite`).toBe(true);
			expect(value, `${key} >= 0`).toBeGreaterThanOrEqual(0);
		}
	});

	it('emits the now marker exactly once, with past strictly before it', () => {
		const { items } = buildPlanTimeline(scenario);
		const nowIdx = items.findIndex((i) => i.kind === 'now');
		expect(items.filter((i) => i.kind === 'now')).toHaveLength(1);

		const pastKinds = items.slice(0, nowIdx).map((i) => i.kind);
		const futureKinds = items.slice(nowIdx + 1).map((i) => i.kind);
		expect(pastKinds).not.toContain('planned');
		for (const k of ['actual', 'rest', 'skipped', 'gap']) {
			expect(futureKinds).not.toContain(k);
		}
	});

	it('never renders the same block in both halves except a straddling one', () => {
		const { items } = buildPlanTimeline(scenario);
		const pastBlockIds = new Set(
			items
				.filter((i) => i.kind === 'rest' || i.kind === 'skipped')
				.map((i) => (i as PlanSkippedItem | { block: PlanBlockResponse }).block.id)
		);
		const futureBlockIds = new Set(
			items.filter((i): i is PlanPlannedItem => i.kind === 'planned').map((i) => i.block.id)
		);
		for (const id of pastBlockIds) expect(futureBlockIds.has(id)).toBe(false);
	});

	it('orders past rows non-decreasingly in time', () => {
		const { items } = buildPlanTimeline(scenario);
		const nowIdx = items.findIndex((i) => i.kind === 'now');
		const keyOf = (i: PlanTimelineItem): number | null => {
			if (i.kind === 'actual') return new Date(i.startedAt).getTime();
			if (i.kind === 'rest' || i.kind === 'skipped') return new Date(i.block.started_at).getTime();
			if (i.kind === 'gap') return new Date((i as PlanGapItem).from).getTime();
			return null;
		};
		const stamps = items
			.slice(0, nowIdx)
			.map(keyOf)
			.filter((v): v is number => v !== null);
		const sorted = [...stamps].sort((a, b) => a - b);
		expect(stamps).toEqual(sorted);
	});

	it('survives an empty plan with work the plan never asked for', () => {
		const timeline = buildPlanTimeline({
			blocks: [],
			entries: [entry({ task_id: 7, started_at: iso(9), finished_at: iso(10) })],
			nowMs: at(12).getTime(),
		});
		const a = actuals(timeline.items)[0];
		expect(a.block).toBeNull();
		expect(a.offScheduleBlock).toBeNull();
		expect(timeline.totals.doneSeconds).toBe(3600);
	});

	it('survives a full plan with no work logged at all', () => {
		const timeline = buildPlanTimeline({
			blocks: scenario.blocks,
			entries: [],
			nowMs: at(12, 30).getTime(),
		});
		expect(timeline.totals.doneSeconds).toBe(0);
		// Two past task blocks skipped (1h each); the café break counts as rest.
		expect(timeline.totals.skippedSeconds).toBe(7200);
		expect(timeline.totals.restSeconds).toBe(1800);
		expect(timeline.totals.remainingPlannedSeconds).toBe(7200);
	});
});
