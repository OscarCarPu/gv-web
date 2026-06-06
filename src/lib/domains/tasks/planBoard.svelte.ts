import { planApi } from '$lib/domains/tasks/api/plan.api';
import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { buildRecurringDueAt } from '$lib/domains/tasks/utils/recurrence';
import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

export interface PlanBoardApi {
	plan: {
		deleteBlock: (id: number) => Promise<void>;
		deleteFutureBlocks: () => Promise<void>;
	};
	tasks: {
		updateTask: (
			id: number,
			input: { started_at?: string; finished_at?: string; due_at?: string }
		) => Promise<unknown>;
	};
}

const defaultApi: PlanBoardApi = { plan: planApi, tasks: tasksApi };

/**
 * Owns Today's Plan budget/derivation logic plus the per-block actions. Mirrors
 * `TaskBoard`: injected `#getInitial` / `#refresh` / `#api`, derived view-state exposed
 * as `get` accessors (NOT `$derived` fields — those would read the injected fields before
 * the constructor assigns them). `nowMs` stays as reactive state here, but the interval
 * that ticks it lives in the component's `$effect` (effects need component lifecycle) and
 * calls `setNow(Date.now())`.
 */
export class PlanBoard {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#getInitial: () => PlanTodayResponse | null;
	#getActiveStartedAt: () => string | null;
	#refresh: () => Promise<void>;
	#api: PlanBoardApi;

	nowMs = $state(Date.now());

	constructor(
		getInitial: () => PlanTodayResponse | null,
		getActiveStartedAt: () => string | null,
		refresh: () => Promise<void>,
		api: PlanBoardApi = defaultApi
	) {
		this.#getInitial = getInitial;
		this.#getActiveStartedAt = getActiveStartedAt;
		this.#refresh = refresh;
		this.#api = api;
	}

	setNow(ms: number): void {
		this.nowMs = ms;
	}

	// ── pure helpers ────────────────────────────────────────────────────

	static blockSeconds(b: PlanBlockResponse): number {
		return Math.max(0, (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000);
	}

	static isStarted(b: PlanBlockResponse): boolean {
		return b.task_started_at !== null && b.task_started_at !== undefined;
	}

	static toggleLabel(b: PlanBlockResponse): string {
		if (!PlanBoard.isStarted(b)) return 'Start';
		return b.task_type === 'recurring' ? 'Renew' : 'Done';
	}

	static formatHour(iso: string): string {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	static formatNow(ms: number): string {
		const d = new Date(ms);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	// ── derived view-state (getters: evaluated on access, reactive in templates) ──

	get data(): PlanTodayResponse | null {
		return this.#getInitial();
	}

	get freeTotal(): number {
		return this.data?.totals.free_seconds ?? 0;
	}

	get dailyTarget(): number {
		return this.data?.budget.daily_target_seconds ?? 0;
	}

	/** Done so far today (real time entries, not the plan). */
	get doneTodaySeconds(): number {
		return this.data?.budget.today ?? 0;
	}

	/**
	 * Future task work according to the plan: linked blocks whose end is in the future.
	 * Full duration if the block hasn't started yet, only the remaining part if it's in
	 * progress.
	 */
	get futureTaskSeconds(): number {
		const data = this.data;
		if (!data) return 0;
		let s = 0;
		for (const b of data.blocks) {
			if (b.task_id === null) continue;
			const start = new Date(b.started_at).getTime();
			const end = new Date(b.ended_at).getTime();
			if (end <= this.nowMs) continue;
			s += (end - Math.max(start, this.nowMs)) / 1000;
		}
		return s;
	}

	/** Elapsed time of the currently running time entry (not yet finished). */
	get activeRunningSeconds(): number {
		const activeStartedAt = this.#getActiveStartedAt();
		if (!activeStartedAt) return 0;
		return Math.max(0, (this.nowMs - new Date(activeStartedAt).getTime()) / 1000);
	}

	get estimatedTotal(): number {
		return this.doneTodaySeconds + this.activeRunningSeconds + this.futureTaskSeconds;
	}

	get estimatedPct(): number {
		return this.dailyTarget > 0 ? Math.min((this.estimatedTotal / this.dailyTarget) * 100, 100) : 0;
	}

	get estimatedReached(): boolean {
		return this.dailyTarget > 0 && this.estimatedTotal >= this.dailyTarget;
	}

	/** Index of the block currently in progress (started_at <= now < ended_at), or -1. */
	get currentIndex(): number {
		const data = this.data;
		if (!data) return -1;
		for (let i = 0; i < data.blocks.length; i++) {
			const start = new Date(data.blocks[i].started_at).getTime();
			const end = new Date(data.blocks[i].ended_at).getTime();
			if (start <= this.nowMs && this.nowMs < end) return i;
		}
		return -1;
	}

	/**
	 * Where to render the "now" line when there is no current block: before the first
	 * block whose started_at is strictly after now. -1 means now has passed every block —
	 * line goes at the end. -2 means don't render the line.
	 */
	get gapInsertIndex(): number {
		const data = this.data;
		if (!data || this.currentIndex !== -1) return -2;
		for (let i = 0; i < data.blocks.length; i++) {
			if (new Date(data.blocks[i].started_at).getTime() > this.nowMs) return i;
		}
		return -1;
	}

	// ── block actions ───────────────────────────────────────────────────

	/** Start / renew / finish the task linked to a block. */
	async toggleBlock(b: PlanBlockResponse): Promise<void> {
		if (b.task_id === null) return;
		const now = new Date().toISOString();
		try {
			if (!PlanBoard.isStarted(b)) {
				await this.#api.tasks.updateTask(b.task_id, { started_at: now });
			} else if (b.task_type === 'recurring' && b.task_recurrence) {
				await this.#api.tasks.updateTask(b.task_id, {
					due_at: buildRecurringDueAt(b.task_recurrence),
				});
			} else {
				await this.#api.tasks.updateTask(b.task_id, { finished_at: now });
			}
			await this.#refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error';
			addToast(msg, 'error');
		}
	}

	async deleteBlock(b: PlanBlockResponse): Promise<void> {
		try {
			await this.#api.plan.deleteBlock(b.id);
			await this.#refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error deleting';
			addToast(msg, 'error');
		}
	}

	async cleanFuture(): Promise<void> {
		try {
			await this.#api.plan.deleteFutureBlocks();
			await this.#refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error cleaning';
			addToast(msg, 'error');
		}
	}
}
