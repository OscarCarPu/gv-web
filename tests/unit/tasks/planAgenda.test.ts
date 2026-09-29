import { describe, it, expect, vi } from 'vitest';
import {
	MIN_BLOCK_MS,
	agendaRange,
	edgeLimits,
	hourMarks,
	mergeCandidate,
	resolveEdge,
	sortBlocks,
	splitPoint,
} from '$lib/domains/tasks/utils/planAgenda';
import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
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
	it('defaults to the working day when nothing is outside it', () => {
		expect(agendaRange([], at(12))).toEqual({ startMs: at(8), endMs: at(20) });
	});

	it('widens to whole hours around blocks and now', () => {
		const blocks = [block({ started_at: iso(6, 30), ended_at: iso(7) })];
		const range = agendaRange(blocks, at(21, 10));
		expect(range).toEqual({ startMs: at(6), endMs: at(22) });
		expect(hourMarks(range)).toHaveLength(17);
	});
});

describe('edge limits', () => {
	const range = { startMs: at(8), endMs: at(20) };
	const sorted = sortBlocks([
		block({ started_at: iso(11), ended_at: iso(12) }),
		block({ started_at: iso(9), ended_at: iso(10) }),
	]);

	it('stops a start edge at the previous block and short of its own end', () => {
		expect(edgeLimits(sorted, 1, 'start', range)).toEqual({
			min: at(10),
			max: at(12) - MIN_BLOCK_MS,
		});
	});

	it('stops an end edge at the next block, or the grid end for the last one', () => {
		expect(edgeLimits(sorted, 0, 'end', range).max).toBe(at(11));
		expect(edgeLimits(sorted, 1, 'end', range).max).toBe(at(20));
	});

	it('snaps to 5 minutes and clamps', () => {
		const limits = { min: at(10), max: at(11) };
		expect(resolveEdge(at(10, 22), limits)).toBe(at(10, 20));
		expect(resolveEdge(at(9, 40), limits)).toBe(at(10));
		expect(resolveEdge(at(11, 30), limits)).toBe(at(11));
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

	it('resize sends both edges', async () => {
		const { api, board } = setup();
		const b = block();
		await board.resizeBlock(b, at(8, 45), at(10));
		expect(api.plan.updateBlock).toHaveBeenCalledWith(b.id, {
			started_at: iso(8, 45),
			ended_at: iso(10),
		});
	});
});
