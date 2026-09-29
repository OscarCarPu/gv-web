import { describe, it, expect, vi } from 'vitest';
import {
	MIN_BLOCK_MS,
	agendaRange,
	blockSpan,
	conflictIds,
	dragSpan,
	hourMarks,
	layoutLanes,
	mergeCandidate,
	planSaveSteps,
	spansOverlap,
	splitPoint,
	type IdSpan,
} from '$lib/domains/tasks/utils/planAgenda';
import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
import { PlanDraft } from '$lib/domains/tasks/planDraft.svelte';
import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

const at = (h: number, min = 0) => new Date(2026, 8, 29, h, min, 0, 0).getTime();
const iso = (h: number, min = 0) => new Date(at(h, min)).toISOString();

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

describe('agendaRange', () => {
	it('defaults to 07:00 through 03:00 of the next day', () => {
		expect(agendaRange([], at(12))).toEqual({ startMs: at(7), endMs: at(27) });
		expect(hourMarks(agendaRange([], at(12)))).toHaveLength(21);
	});

	it('widens to whole hours around blocks and now', () => {
		const spans = [
			blockSpan(block({ started_at: iso(6, 30), ended_at: iso(7) })),
			blockSpan(block({ started_at: iso(27), ended_at: iso(27, 30) })),
		];
		expect(agendaRange(spans, at(12))).toEqual({ startMs: at(6), endMs: at(28) });
	});
});

describe('dragSpan', () => {
	const range = { startMs: at(8), endMs: at(20) };
	const origin = { startMs: at(9), endMs: at(10) };
	const min = (m: number) => m * 60_000;

	it('moves an edge in 5-minute steps, never past the other edge', () => {
		expect(dragSpan(origin, 'end', min(22), range)).toEqual({ startMs: at(9), endMs: at(10, 20) });
		expect(dragSpan(origin, 'start', min(90), range)).toEqual({
			startMs: at(10) - MIN_BLOCK_MS,
			endMs: at(10),
		});
	});

	it('moves the whole block keeping its length, inside the grid', () => {
		expect(dragSpan(origin, 'move', min(47), range)).toEqual({
			startMs: at(9, 45),
			endMs: at(10, 45),
		});
		expect(dragSpan(origin, 'move', -min(300), range)).toEqual({ startMs: at(8), endMs: at(9) });
	});
});

describe('overlaps', () => {
	const spans: IdSpan[] = [
		{ id: 1, startMs: at(9), endMs: at(10) },
		{ id: 2, startMs: at(9, 30), endMs: at(11) },
		{ id: 3, startMs: at(10, 30), endMs: at(12) },
		{ id: 4, startMs: at(12), endMs: at(13) },
	];

	it('flags every block sharing time, not touching ones', () => {
		expect([...conflictIds(spans)].sort()).toEqual([1, 2, 3]);
	});

	it('lays overlapping blocks out in lanes, lone ones full width', () => {
		const lanes = layoutLanes(spans);
		expect(lanes.get(1)).toEqual({ lane: 0, lanes: 2 });
		expect(lanes.get(2)).toEqual({ lane: 1, lanes: 2 });
		expect(lanes.get(3)).toEqual({ lane: 0, lanes: 2 });
		expect(lanes.get(4)).toEqual({ lane: 0, lanes: 1 });
	});
});

describe('planSaveSteps', () => {
	/** Replays the steps the way the API would, failing on any overlap. */
	function replay(current: IdSpan[], steps: NonNullable<ReturnType<typeof planSaveSteps>>) {
		const state = new Map(current.map((s) => [s.id, s]));
		for (const step of steps) {
			for (const [id, other] of state) {
				if (id !== step.id) expect(spansOverlap(step, other)).toBe(false);
			}
			state.set(step.id, step);
		}
		return [...state.values()].map(({ id, startMs, endMs }) => ({ id, startMs, endMs }));
	}

	it('orders moves so each one lands on free time', () => {
		const current = [
			{ id: 1, startMs: at(9), endMs: at(10) },
			{ id: 2, startMs: at(10), endMs: at(11) },
		];
		// 2 moves later first, then 1 can grow into the freed hour.
		const target = [
			{ id: 1, startMs: at(9), endMs: at(11) },
			{ id: 2, startMs: at(11), endMs: at(12) },
		];
		const steps = planSaveSteps(current, target)!;
		expect(steps.map((s) => s.id)).toEqual([2, 1]);
		expect(replay(current, steps)).toEqual(target);
	});

	it('parks one block to swap two adjacent ones', () => {
		const current = [
			{ id: 1, startMs: at(9), endMs: at(10) },
			{ id: 2, startMs: at(10), endMs: at(11) },
		];
		const target = [
			{ id: 1, startMs: at(10), endMs: at(11) },
			{ id: 2, startMs: at(9), endMs: at(10) },
		];
		const steps = planSaveSteps(current, target)!;
		expect(steps.some((s) => s.parking)).toBe(true);
		expect(replay(current, steps).sort((a, b) => a.id - b.id)).toEqual(target);
	});

	it('skips unchanged blocks and refuses an overlapping target', () => {
		const current = [{ id: 1, startMs: at(9), endMs: at(10) }];
		expect(planSaveSteps(current, current)).toEqual([]);
		const overlapping = [...current, { id: 2, startMs: at(9, 30), endMs: at(10, 30) }];
		expect(planSaveSteps(overlapping, overlapping)).toBeNull();
	});
});

describe('splitPoint', () => {
	it('cuts at the snapped midpoint', () => {
		expect(splitPoint(block({ started_at: iso(9), ended_at: iso(9, 50) }))).toBe(at(9, 25));
	});

	it('refuses blocks too short for two halves', () => {
		expect(splitPoint(block({ started_at: iso(9), ended_at: iso(9, 5) }))).toBeNull();
	});
});

describe('mergeCandidate', () => {
	it('offers the next block only when it links the same task', () => {
		const a = block({ started_at: iso(9), ended_at: iso(10) });
		const same = block({ started_at: iso(10), ended_at: iso(11) });
		const other = block({ started_at: iso(11), ended_at: iso(12), task_id: 200 });
		const sorted = [a, same, other];
		expect(mergeCandidate(sorted, 0)).toBe(same);
		expect(mergeCandidate(sorted, 1)).toBeNull();
		expect(mergeCandidate(sorted, 2)).toBeNull();
	});

	it('never merges free-time blocks', () => {
		const sorted = [block({ task_id: null }), block({ task_id: null, started_at: iso(10) })];
		expect(mergeCandidate(sorted, 0)).toBeNull();
	});
});

describe('PlanBoard agenda edits', () => {
	function setup() {
		const api = {
			plan: {
				createBlock: vi.fn().mockResolvedValue({}),
				updateBlock: vi.fn().mockResolvedValue({}),
				deleteBlock: vi.fn().mockResolvedValue(undefined),
				deleteFutureBlocks: vi.fn().mockResolvedValue(undefined),
			},
			tasks: { updateTask: vi.fn().mockResolvedValue({}) },
		};
		const refresh = vi.fn().mockResolvedValue(undefined);
		const board = new PlanBoard(
			() => null,
			() => [],
			refresh,
			api
		);
		return { api, refresh, board };
	}

	it('split shrinks the original before creating the second half', async () => {
		const { api, refresh, board } = setup();
		const b = block({ started_at: iso(9), ended_at: iso(10), note: 'n' });
		await board.splitBlock(b);
		expect(api.plan.updateBlock).toHaveBeenCalledWith(b.id, { ended_at: iso(9, 30) });
		expect(api.plan.createBlock).toHaveBeenCalledWith({
			started_at: iso(9, 30),
			ended_at: iso(10),
			task_id: 100,
			label: 'Task A',
			note: 'n',
		});
		expect(api.plan.updateBlock.mock.invocationCallOrder[0]).toBeLessThan(
			api.plan.createBlock.mock.invocationCallOrder[0]
		);
		expect(refresh).toHaveBeenCalled();
	});

	it('merge deletes the next block before stretching over it', async () => {
		const { api, board } = setup();
		const a = block({ started_at: iso(9), ended_at: iso(10) });
		const b = block({ started_at: iso(10, 30), ended_at: iso(11), note: 'keep' });
		await board.mergeBlocks(a, b);
		expect(api.plan.deleteBlock).toHaveBeenCalledWith(b.id);
		expect(api.plan.updateBlock).toHaveBeenCalledWith(a.id, { ended_at: iso(11), note: 'keep' });
		expect(api.plan.deleteBlock.mock.invocationCallOrder[0]).toBeLessThan(
			api.plan.updateBlock.mock.invocationCallOrder[0]
		);
	});

	it('merge refuses different tasks', async () => {
		const { api, board } = setup();
		await board.mergeBlocks(block(), block({ task_id: 7 }));
		expect(api.plan.deleteBlock).not.toHaveBeenCalled();
	});
});

describe('PlanDraft', () => {
	function setup() {
		const api = {
			createBlock: vi.fn().mockResolvedValue({}),
			updateBlock: vi.fn().mockResolvedValue({}),
		};
		return { api, draft: new PlanDraft(api), refresh: vi.fn().mockResolvedValue(undefined) };
	}

	it('ignores a drafted span once the server times change under it', () => {
		const { draft } = setup();
		const b = block({ started_at: iso(9), ended_at: iso(10) });
		draft.setSpan(b.id, { startMs: at(11), endMs: at(12) }, blockSpan(b));
		expect(draft.spanFor(b)).toEqual({ startMs: at(11), endMs: at(12) });
		expect(draft.dirtyCount([b])).toBe(1);
		const edited = { ...b, started_at: iso(13), ended_at: iso(14) };
		expect(draft.spanFor(edited)).toBeNull();
		expect(draft.dirtyCount([edited])).toBe(0);
	});

	it('saves a new overlapping block after moving the one in its way', async () => {
		const { api, draft, refresh } = setup();
		const existing = block({ started_at: iso(9), ended_at: iso(10) });
		// The new block was refused for sitting on 9–10; the user moved the old one to 10–11.
		draft.addNew({ task_id: null, label: 'Call', note: null }, 'Call', {
			startMs: at(9),
			endMs: at(10),
		});
		draft.setSpan(existing.id, { startMs: at(10), endMs: at(11) }, blockSpan(existing));
		const newId = draft.added[0].id;
		const ok = await draft.save(
			() => [existing],
			[
				{ id: existing.id, startMs: at(10), endMs: at(11) },
				{ id: newId, startMs: at(9), endMs: at(10) },
			],
			refresh
		);
		expect(ok).toBe(true);
		expect(api.updateBlock).toHaveBeenCalledWith(existing.id, {
			started_at: iso(10),
			ended_at: iso(11),
		});
		expect(api.createBlock).toHaveBeenCalledWith({
			task_id: null,
			label: 'Call',
			note: null,
			started_at: iso(9),
			ended_at: iso(10),
		});
		expect(api.updateBlock.mock.invocationCallOrder[0]).toBeLessThan(
			api.createBlock.mock.invocationCallOrder[0]
		);
		expect(draft.added).toEqual([]);
		expect(refresh).toHaveBeenCalled();
	});

	it('keeps what did not save, and never recreates what did', async () => {
		const { api, draft, refresh } = setup();
		draft.addNew({ label: 'A' }, 'A', { startMs: at(9), endMs: at(10) });
		draft.addNew({ label: 'B' }, 'B', { startMs: at(11), endMs: at(12) });
		const [a, b] = draft.added.map((n) => n.id);
		api.createBlock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('boom'));
		const ok = await draft.save(
			() => [],
			[
				{ id: a, startMs: at(9), endMs: at(10) },
				{ id: b, startMs: at(11), endMs: at(12) },
			],
			refresh
		);
		expect(ok).toBe(false);
		expect(draft.added.map((n) => n.label)).toEqual(['B']);
	});

	it('refuses to save while blocks overlap', async () => {
		const { api, draft, refresh } = setup();
		const ok = await draft.save(
			() => [],
			[
				{ id: -1, startMs: at(9), endMs: at(10) },
				{ id: -2, startMs: at(9, 30), endMs: at(10, 30) },
			],
			refresh
		);
		expect(ok).toBe(false);
		expect(api.createBlock).not.toHaveBeenCalled();
	});
});
