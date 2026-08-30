import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { SvelteSet } from 'svelte/reactivity';
import { toLocalDateString } from '$lib/shared/utils/datetime';
import { buildRecurringDueAt } from '$lib/domains/tasks/utils/recurrence';
import {
	groupTasksByUrgency,
	truncateDueSoonGroups,
	type DueSoonGroup,
} from '$lib/domains/tasks/utils/dueSoonGrouping';
import {
	flattenProjectsFromTree,
	collectProjectIds,
	filterTree,
	findTreeTask,
	findTreeProject,
} from '$lib/domains/tasks/utils/taskTree';
import type { ActiveTreeNode, TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';

// Deliberately smaller than the app's usual 15/10 fold (see CLAUDE.md): Due Soon cards carry
// more per-item content (badges, urgency phrase) than a plain list row, and this section is
// tiered by urgency now — "today + this week" should fit without much scroll, "later" is one
// click away behind "show more" rather than pre-rendered.
const FOLD_LIMIT = 8;
const EXPAND_STEP = 8;

/** Live slice of the page's SSR `data` the board reads + optimistically mutates. */
export interface TaskBoardData {
	tasksByDueDate: TaskByDueDateResponse[];
	activeTree: ActiveTreeNode[];
}

export interface TaskBoardApi {
	updateTask: (
		id: number,
		input: { started_at?: string; finished_at?: string; due_at?: string }
	) => Promise<unknown>;
	updateProject: (
		id: number,
		input: { started_at?: string; finished_at?: string }
	) => Promise<unknown>;
}

/**
 * Owns the tasks page's non-timer logic: the Due Soon / Active Projects filters and
 * folding, plus the optimistic start/finish/renew flows (with rollback) for tasks and
 * projects. Mirrors `TaskTimer`: injected `#api`, named methods, reactive state read
 * directly by the template. Anything time-entry shaped — including the day/week summary —
 * belongs to `TimeEntries`, not here.
 */
export class TaskBoard {
	// Injected (assigned in constructor; declared first so derived fields may reference them).
	#getData: () => TaskBoardData;
	#refresh: () => Promise<void>;
	#api: TaskBoardApi;

	// Pending = optimistically finished, hidden until the reload confirms. SvelteSet is already reactive.
	pendingTaskIds = new SvelteSet<number>();
	pendingProjectIds = new SvelteSet<number>();

	// Filter / fold state.
	duePriorityFilter = $state<number | null>(null);
	dueProjectFilter = $state<number | null>(null);
	treePriorityFilter = $state<number | null>(null);
	dueVisibleCount = $state(FOLD_LIMIT);

	constructor(
		getData: () => TaskBoardData,
		refresh: () => Promise<void>,
		api: TaskBoardApi = tasksApi
	) {
		this.#getData = getData;
		this.#refresh = refresh;
		this.#api = api;
	}

	// ── derived view-state (getters: evaluated on access, reactive in templates) ──

	get dueProjectOptions(): { id: number; name: string; depth: number }[] {
		return flattenProjectsFromTree(this.#getData().activeTree);
	}

	get #dueProjectIds(): Set<number> | null {
		return this.dueProjectFilter === null
			? null
			: collectProjectIds(this.#getData().activeTree, this.dueProjectFilter);
	}

	get filteredByDueDate(): TaskByDueDateResponse[] {
		const ids = this.#dueProjectIds;
		return (
			this.duePriorityFilter === null
				? this.#getData().tasksByDueDate
				: this.#getData().tasksByDueDate.filter((t) => t.priority <= this.duePriorityFilter!)
		)
			.filter((t) => !this.pendingTaskIds.has(t.id))
			.filter((t) => {
				if (ids === null) return true;
				return t.project_id !== null && ids.has(t.project_id);
			});
	}

	/** Due Soon split into urgency tiers, each internally sorted — see dueSoonGrouping.ts. */
	get groupedDueDateTasks(): DueSoonGroup[] {
		return groupTasksByUrgency(this.filteredByDueDate);
	}

	/** Same groups, truncated to the fold budget — tiering happens before folding, not after,
	 *  so an urgent task ranked low in plain date order still isn't cut off by the fold. */
	get visibleDueSoonGroups(): DueSoonGroup[] {
		return truncateDueSoonGroups(this.groupedDueDateTasks, this.dueVisibleCount);
	}

	get dueTodayCount(): number {
		const today = toLocalDateString();
		let n = 0;
		for (const t of this.filteredByDueDate) {
			const d = t.due_at ?? t.project_due_at;
			if (d && d.slice(0, 10) <= today) n++;
		}
		return n;
	}

	get hasMoreDueDateTasks(): boolean {
		return this.dueVisibleCount < this.filteredByDueDate.length;
	}

	get remainingDueDateTasks(): number {
		return this.filteredByDueDate.length - this.dueVisibleCount;
	}

	get filteredActiveTree(): ActiveTreeNode[] {
		return filterTree(
			this.#getData().activeTree,
			this.treePriorityFilter,
			this.pendingTaskIds,
			this.pendingProjectIds
		);
	}

	// ── filters / folding ──────────────────────────────────────────────

	setDuePriority(value: number | null): void {
		this.duePriorityFilter = value;
		this.dueVisibleCount = FOLD_LIMIT;
	}

	setDueProject(value: number | null): void {
		this.dueProjectFilter = value;
		this.dueVisibleCount = FOLD_LIMIT;
	}

	setTreePriority(value: number | null): void {
		this.treePriorityFilter = value;
	}

	showMore(): void {
		this.dueVisibleCount = Math.min(
			this.dueVisibleCount + EXPAND_STEP,
			this.filteredByDueDate.length
		);
	}

	// ── optimistic task / project lifecycle ────────────────────────────

	/** Start / finish / renew a task from the Due Soon list (optimistic, rolls back on error). */
	async toggleTask(taskId: number, action: 'start' | 'finish'): Promise<void> {
		const now = new Date().toISOString();
		const task = this.#getData().tasksByDueDate.find((t) => t.id === taskId);
		if (!task) return;

		if (action === 'start') {
			const prev = task.started_at;
			task.started_at = now;
			addNotification('Task started', 'success');
			try {
				await this.#api.updateTask(taskId, { started_at: now });
				await this.#refresh();
			} catch {
				task.started_at = prev;
				addToast('Error starting task', 'error');
			}
			return;
		}

		if (task.task_type === 'recurring' && task.recurrence) {
			const prev = task.due_at;
			const newDueAt = buildRecurringDueAt(task.recurrence);
			task.due_at = newDueAt;
			addNotification('Task renewed', 'success');
			try {
				await this.#api.updateTask(taskId, { due_at: newDueAt });
				await this.#refresh();
			} catch {
				task.due_at = prev;
				addToast('Error renewing task', 'error');
			}
			return;
		}

		this.pendingTaskIds.add(taskId);
		addNotification('Task finished', 'success');
		try {
			await this.#api.updateTask(taskId, { finished_at: now });
			await this.#refresh();
		} catch {
			this.pendingTaskIds.delete(taskId);
			addToast('Error finishing task', 'error');
		}
	}

	/** Start / finish / renew a task or project from the Active Projects tree. */
	async toggleTreeNode(
		id: number,
		type: 'project' | 'task',
		action: 'start' | 'finish'
	): Promise<void> {
		const now = new Date().toISOString();

		if (type === 'project') {
			const project = findTreeProject(this.#getData().activeTree, id);
			if (action === 'start') {
				const prev = project?.started_at;
				if (project) project.started_at = now;
				addNotification('Project started', 'success');
				try {
					await this.#api.updateProject(id, { started_at: now });
					await this.#refresh();
				} catch {
					if (project) project.started_at = prev ?? null;
					addToast('Error starting project', 'error');
				}
				return;
			}
			this.pendingProjectIds.add(id);
			addNotification('Project finished', 'success');
			try {
				await this.#api.updateProject(id, { finished_at: now });
				await this.#refresh();
			} catch {
				this.pendingProjectIds.delete(id);
				addToast('Error finishing project', 'error');
			}
			return;
		}

		const task = findTreeTask(this.#getData().activeTree, id);
		if (action === 'start') {
			const prev = task?.started_at;
			if (task) task.started_at = now;
			addNotification('Task started', 'success');
			try {
				await this.#api.updateTask(id, { started_at: now });
				await this.#refresh();
			} catch {
				if (task) task.started_at = prev ?? null;
				addToast('Error starting task', 'error');
			}
			return;
		}

		if (task?.task_type === 'recurring' && task.recurrence) {
			const prev = task.due_at;
			const newDueAt = buildRecurringDueAt(task.recurrence);
			task.due_at = newDueAt;
			addNotification('Task renewed', 'success');
			try {
				await this.#api.updateTask(id, { due_at: newDueAt });
				await this.#refresh();
			} catch {
				task.due_at = prev;
				addToast('Error renewing task', 'error');
			}
			return;
		}

		this.pendingTaskIds.add(id);
		addNotification('Task finished', 'success');
		try {
			await this.#api.updateTask(id, { finished_at: now });
			await this.#refresh();
		} catch {
			this.pendingTaskIds.delete(id);
			addToast('Error finishing task', 'error');
		}
	}
}
