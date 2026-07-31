import { planApi } from '$lib/domains/tasks/api/plan.api';
import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { buildRecurringDueAt } from '$lib/domains/tasks/utils/recurrence';
import {
	buildPlanTimeline,
	blockSeconds,
	type PlanTimeline,
	type PlanTimelineItem,
} from '$lib/domains/tasks/utils/planOverlay';
import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

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
 * Owns Today's Plan: the actual-over-intent timeline, the budget derivation, and the
 * per-block actions. Mirrors `TaskBoard`: injected `#getInitial` / `#getEntries` /
 * `#refresh` / `#api`, derived view-state exposed as `get` accessors (NOT `$derived` fields —
 * those would read the injected fields before the constructor assigns them). `nowMs` stays as
 * reactive state here, but the interval that ticks it lives in the component's `$effect`
 * (effects need component lifecycle) and calls `setNow(Date.now())`.
 *
 * The past half of the render comes from real time entries, not from blocks — see
 * `buildPlanTimeline`. Blocks only speak for the future.
 */
export class PlanBoard {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#getInitial: () => PlanTodayResponse | null;
	#getEntries: () => TimeEntryWithTask[];
	#refresh: () => Promise<void>;
	#api: PlanBoardApi;

	nowMs = $state(Date.now());

	constructor(
		getInitial: () => PlanTodayResponse | null,
		getEntries: () => TimeEntryWithTask[],
		refresh: () => Promise<void>,
		api: PlanBoardApi = defaultApi
	) {
		this.#getInitial = getInitial;
		this.#getEntries = getEntries;
		this.#refresh = refresh;
		this.#api = api;
	}

	setNow(ms: number): void {
		this.nowMs = ms;
	}

	// ── pure helpers ────────────────────────────────────────────────────

	static blockSeconds(b: PlanBlockResponse): number {
		return blockSeconds(b);
	}

	static isStarted(b: PlanBlockResponse): boolean {
		return b.task_started_at !== null && b.task_started_at !== undefined;
	}

	static toggleLabel(b: PlanBlockResponse): string {
		if (!PlanBoard.isStarted(b)) return 'Start';
		return b.task_type === 'recurring' ? 'Renew' : 'Done';
	}

	static isFinished(b: PlanBlockResponse): boolean {
		return b.task_finished_at !== null && b.task_finished_at !== undefined;
	}

	// ── derived view-state (getters: evaluated on access, reactive in templates) ──

	get data(): PlanTodayResponse | null {
		return this.#getInitial();
	}

	/** Today's plan folded over today's real time entries. */
	get timeline(): PlanTimeline {
		const data = this.data;
		return buildPlanTimeline({
			blocks: data?.blocks ?? [],
			entries: this.#getEntries(),
			nowMs: this.nowMs,
		});
	}

	get items(): PlanTimelineItem[] {
		return this.timeline.items;
	}

	/** The block containing now, or null. Drives the alarm and the "current" highlight. */
	get currentBlock(): PlanBlockResponse | null {
		const data = this.data;
		if (!data) return null;
		for (const b of data.blocks) {
			const start = new Date(b.started_at).getTime();
			const end = new Date(b.ended_at).getTime();
			if (start <= this.nowMs && this.nowMs < end) return b;
		}
		return null;
	}

	get freeTotal(): number {
		return this.data?.totals.free_seconds ?? 0;
	}

	get dailyTarget(): number {
		return this.data?.budget.daily_target_seconds ?? 0;
	}

	/** Done so far today, measured from the entries themselves rather than the summary so the
	 *  bar and the timeline rows can never disagree. */
	get doneTodaySeconds(): number {
		return this.timeline.totals.doneSeconds;
	}

	/** Planned task time still ahead of now. */
	get futureTaskSeconds(): number {
		return this.timeline.totals.remainingPlannedSeconds;
	}

	/** Where the day lands if every remaining planned block is honoured. */
	get estimatedTotal(): number {
		return this.doneTodaySeconds + this.futureTaskSeconds;
	}

	get estimatedPct(): number {
		return this.dailyTarget > 0 ? Math.min((this.estimatedTotal / this.dailyTarget) * 100, 100) : 0;
	}

	/** Share of the bar already earned, so the fill can distinguish done from projected. */
	get donePct(): number {
		return this.dailyTarget > 0
			? Math.min((this.doneTodaySeconds / this.dailyTarget) * 100, 100)
			: 0;
	}

	get estimatedReached(): boolean {
		return this.dailyTarget > 0 && this.estimatedTotal >= this.dailyTarget;
	}

	get unplannedSeconds(): number {
		return this.timeline.totals.unplannedSeconds;
	}

	get skippedSeconds(): number {
		return this.timeline.totals.skippedSeconds;
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
