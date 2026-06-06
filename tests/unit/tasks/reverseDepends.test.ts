import { describe, it, expect, vi } from 'vitest';
import { planReverseDependsSync } from '$lib/domains/tasks/utils/reverseDepends';
import type { TaskDepRef, TaskFullResponse } from '$lib/domains/tasks/types/Task.types';

function dep(id: number): TaskDepRef {
	return { id, name: `Task ${id}`, due_at: null };
}

/** Build a minimal TaskFullResponse whose `depends_on` is the given id list. */
function fullTask(id: number, dependsOnIds: number[]): TaskFullResponse {
	return {
		id,
		project_id: null,
		name: `Task ${id}`,
		description: null,
		due_at: null,
		started_at: null,
		finished_at: null,
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		time_spent: 0,
		todos: [],
		depends_on: dependsOnIds.map(dep),
		blocks: [],
		blocked: false,
	};
}

/** A fake `fetchTask` backed by a map of id → current depends_on ids. */
function makeFetch(depsById: Record<number, number[]>) {
	return vi.fn(async (id: number) => fullTask(id, depsById[id] ?? []));
}

describe('planReverseDependsSync', () => {
	const TASK_ID = 100;

	it('returns [] and never fetches when blocks are unchanged (omit = unchanged)', async () => {
		const fetchTask = makeFetch({});
		const blocks = [dep(1), dep(2)];

		const updates = await planReverseDependsSync(TASK_ID, blocks, blocks, fetchTask);

		expect(updates).toEqual([]);
		expect(fetchTask).not.toHaveBeenCalled();
	});

	it('adding a block makes the target depend on the source task', async () => {
		// Blocked task 1 currently depends on [5]; adding the block means it should also depend on 100.
		const fetchTask = makeFetch({ 1: [5] });

		const updates = await planReverseDependsSync(TASK_ID, [], [dep(1)], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [5, 100] }]);
		expect(fetchTask).toHaveBeenCalledWith(1);
	});

	it('removing a block strips the source task from the target depends_on', async () => {
		// Target 1 currently depends on [5, 100]; removing the block drops 100.
		const fetchTask = makeFetch({ 1: [5, 100] });

		const updates = await planReverseDependsSync(TASK_ID, [dep(1)], [], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [5] }]);
	});

	it('does NOT duplicate an already-present edge when adding', async () => {
		// Target 1 already depends on 100 — added side is conditional, so no update is emitted.
		const fetchTask = makeFetch({ 1: [100] });

		const updates = await planReverseDependsSync(TASK_ID, [], [dep(1)], fetchTask);

		expect(updates).toEqual([]);
		// It still fetches to inspect the current deps.
		expect(fetchTask).toHaveBeenCalledWith(1);
	});

	it('still emits a (no-op idempotent) update when removing an edge that is already absent', async () => {
		// Target 1 does NOT depend on 100; removed side always emits the filtered array.
		const fetchTask = makeFetch({ 1: [7, 8] });

		const updates = await planReverseDependsSync(TASK_ID, [dep(1)], [], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [7, 8] }]);
	});

	it('handles multiple adds and removes in one call, preserving fetch order/offset', async () => {
		// initial = [1, 2], current = [2, 3, 4]
		//   added   = [3, 4]  (in current, not initial)
		//   removed = [1]     (in initial, not current)
		// fetch order = [...added, ...removed] = [3, 4, 1]
		const fetchTask = makeFetch({
			3: [9], // add → [9, 100]
			4: [100], // add but already present → skipped
			1: [100, 11], // remove → [11]
		});

		const updates = await planReverseDependsSync(
			TASK_ID,
			[dep(1), dep(2)],
			[dep(2), dep(3), dep(4)],
			fetchTask
		);

		expect(updates).toEqual([
			{ id: 3, depends_on: [9, 100] },
			{ id: 1, depends_on: [11] },
		]);
		// All three affected targets fetched exactly once; the unchanged block (2) is not fetched.
		expect(fetchTask).toHaveBeenCalledTimes(3);
		expect(fetchTask).toHaveBeenCalledWith(3);
		expect(fetchTask).toHaveBeenCalledWith(4);
		expect(fetchTask).toHaveBeenCalledWith(1);
		expect(fetchTask).not.toHaveBeenCalledWith(2);
	});

	it('append puts the source task id at the END of the existing depends_on', async () => {
		const fetchTask = makeFetch({ 1: [3, 5, 7] });

		const updates = await planReverseDependsSync(TASK_ID, [], [dep(1)], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [3, 5, 7, 100] }]);
	});

	it('removal removes EVERY occurrence of the source id (filter, not first match)', async () => {
		// Defensive: a corrupt target listing 100 twice gets both stripped.
		const fetchTask = makeFetch({ 1: [100, 5, 100] });

		const updates = await planReverseDependsSync(TASK_ID, [dep(1)], [], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [5] }]);
	});

	it('adding a brand-new block to a target with no existing deps', async () => {
		const fetchTask = makeFetch({ 1: [] });

		const updates = await planReverseDependsSync(TASK_ID, [], [dep(1)], fetchTask);

		expect(updates).toEqual([{ id: 1, depends_on: [100] }]);
	});
});
