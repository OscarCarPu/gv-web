import type { TaskDepRef, TaskFullResponse } from '$lib/domains/tasks/types/Task.types';

/** A single reverse-edge update to apply via `tasksApi.updateTask`. */
export interface ReverseDependUpdate {
	id: number;
	depends_on: number[];
}

/**
 * Pure planner for the reverse-dependency ("blocks") reconciliation.
 *
 * Mirrors the exact semantics of the original `syncReverseDepends` in
 * `TaskBottomSheet.svelte`:
 *   - `initialBlocks` is the source of truth for what was there at load time;
 *     `currentBlocks` is what the user ended up with.
 *   - `added`   = current blocks whose id was NOT in the initial set.
 *   - `removed` = initial blocks whose id is NOT in the current set.
 *   - No added & no removed → returns `[]` (omit = unchanged).
 *   - For each ADDED target: fetch it, read its current `depends_on` ids, and only
 *     emit an update if `taskId` is NOT already present (no duplicate edge).
 *   - For each REMOVED target: fetch it, filter `taskId` out of its `depends_on`,
 *     and ALWAYS emit the (idempotent) update.
 *
 * The diff/fetch logic lives here so it is unit-testable without the network; the
 * controller applies the returned updates via `api.updateTask`.
 */
export async function planReverseDependsSync(
	taskId: number,
	initialBlocks: TaskDepRef[],
	currentBlocks: TaskDepRef[],
	fetchTask: (id: number) => Promise<TaskFullResponse>
): Promise<ReverseDependUpdate[]> {
	const initialIds = new Set(initialBlocks.map((d) => d.id));
	const currentIds = new Set(currentBlocks.map((d) => d.id));
	const added = currentBlocks.filter((d) => !initialIds.has(d.id));
	const removed = initialBlocks.filter((d) => !currentIds.has(d.id));
	if (added.length === 0 && removed.length === 0) return [];

	const targets = [...added, ...removed];
	const fetched = await Promise.all(targets.map((d) => fetchTask(d.id)));
	const updates: ReverseDependUpdate[] = [];
	for (let i = 0; i < added.length; i++) {
		const otherDeps = fetched[i].depends_on.map((d) => d.id);
		if (!otherDeps.includes(taskId)) {
			updates.push({ id: added[i].id, depends_on: [...otherDeps, taskId] });
		}
	}
	for (let i = 0; i < removed.length; i++) {
		const other = fetched[added.length + i];
		const otherDeps = other.depends_on.map((d) => d.id).filter((id) => id !== taskId);
		updates.push({ id: removed[i].id, depends_on: otherDeps });
	}
	return updates;
}
