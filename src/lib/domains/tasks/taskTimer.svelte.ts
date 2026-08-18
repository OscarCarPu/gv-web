import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { formatElapsed } from '$lib/shared/utils/datetime';
import type {
	CreateTimeEntryRequest,
	UpdateTimeEntryRequest,
} from '$lib/domains/tasks/types/Task.types';

export interface TaskTimerApi {
	createTimeEntry: (input: CreateTimeEntryRequest) => Promise<{ id: number }>;
	updateTimeEntry: (id: number, input: UpdateTimeEntryRequest) => Promise<unknown>;
	deleteTimeEntry: (id: number) => Promise<void>;
}

/** A task descriptor passed by the three task-page sections to the timer. */
export interface TimerTask {
	id: number;
	name: string;
	projectName?: string | null;
	description?: string | null;
}

/** Shape of the active time entry used to restore the timer after SSR rehydration. */
interface RestoreEntry {
	id: number;
	task_id: number;
	started_at: string;
	task_name: string;
	project_name?: string | null;
	comment?: string | null;
	task_description?: string | null;
}

/**
 * Owns all time-entry logic for the tasks page. The three sections (Due Soon,
 * Today's Plan, Active Projects) drive it through three clearly-named methods:
 *   - `start(task)`            — begin a brand-new entry (only when not running)
 *   - `replaceForTaskId(task)` — reassign the running entry to another task ("Assign")
 *   - `stopAndStart(task)`     — `finish()` the current entry then `start(task)`
 */
export class TaskTimer {
	// Public reactive state, read directly by templates.
	selectedTaskId = $state<number | null>(null);
	selectedTaskDisplay = $state<string | null>(null);
	selectedTaskDescription = $state<string | null>(null);
	activeTimeEntryId = $state<number | null>(null);
	isRunning = $state(false);
	elapsedSeconds = $state(0);
	comment = $state('');

	// Private, non-template state. Declared before the derived fields that read them.
	#api: TaskTimerApi;
	#startedAt = $state<number | null>(null);
	#timerInterval: ReturnType<typeof setInterval> | null = null;
	#commentTimeout: ReturnType<typeof setTimeout> | null = null;

	// Public derived state.
	formattedTime = $derived(formatElapsed(this.elapsedSeconds));
	startedAtDate = $derived(this.#startedAt === null ? null : new Date(this.#startedAt));

	constructor(api: TaskTimerApi = tasksApi) {
		this.#api = api;
	}

	// ── private helpers ────────────────────────────────────────────────

	static #display(task: TimerTask): string {
		return task.projectName ? `${task.name} - ${task.projectName}` : task.name;
	}

	/** Select a task into the panel (id + display + description). */
	#applyTask(task: TimerTask): void {
		this.selectedTaskId = task.id;
		this.selectedTaskDisplay = TaskTimer.#display(task);
		this.selectedTaskDescription = task.description ?? null;
	}

	#tick(): void {
		this.#timerInterval = setInterval(() => {
			this.elapsedSeconds = Math.floor((Date.now() - this.#startedAt!) / 1000);
		}, 1000);
	}

	/** Start ticking from the current `#startedAt`. */
	#begin(): void {
		this.#tick();
		this.isRunning = true;
	}

	#clearTimers(): void {
		if (this.#timerInterval) clearInterval(this.#timerInterval);
		this.#timerInterval = null;
		if (this.#commentTimeout) clearTimeout(this.#commentTimeout);
		this.#commentTimeout = null;
	}

	#clearState(): void {
		this.isRunning = false;
		this.elapsedSeconds = 0;
		this.#startedAt = null;
		this.selectedTaskId = null;
		this.selectedTaskDisplay = null;
		this.selectedTaskDescription = null;
		this.activeTimeEntryId = null;
		this.comment = '';
	}

	// ── public API ─────────────────────────────────────────────────────

	/** Manual top-panel "Start": begin ticking with no time entry yet. */
	startClock(): void {
		if (this.#startedAt === null) this.#startedAt = Date.now();
		this.#begin();
	}

	/** Per-row "Start": create a new entry at now and begin ticking. Only when not running. */
	async start(task: TimerTask): Promise<void> {
		if (this.isRunning) return;
		this.#applyTask(task);
		this.#startedAt = Date.now();
		this.#begin();
		const entry = await this.#api.createTimeEntry({
			task_id: task.id,
			started_at: new Date(this.#startedAt).toISOString(),
			comment: this.comment || null,
		});
		this.activeTimeEntryId = entry.id;
	}

	/** "Assign": point the running timer at another task. */
	async replaceForTaskId(task: TimerTask): Promise<void> {
		if (!this.isRunning) return;
		this.#applyTask(task);
		if (this.activeTimeEntryId) {
			// Reassign the existing entry — no time logged, just a different task.
			await this.#api.updateTimeEntry(this.activeTimeEntryId, { task_id: task.id });
		} else {
			// Manual clock was started with no entry — create one backdated to keep elapsed time.
			const entry = await this.#api.createTimeEntry({
				task_id: task.id,
				started_at: new Date(this.#startedAt!).toISOString(),
				comment: this.comment || null,
			});
			this.activeTimeEntryId = entry.id;
		}
	}

	/** Finish the current entry (finished_at = now) and clear all state. */
	async finish(): Promise<void> {
		this.#clearTimers();

		const entryId = this.activeTimeEntryId;
		const finalComment = this.comment;
		const finishedAt = new Date().toISOString();

		this.#clearState();

		if (entryId) {
			await this.#api.updateTimeEntry(entryId, {
				finished_at: finishedAt,
				comment: finalComment || null,
			});
		}
	}

	/** Stop the current entry at now and start a fresh one for `task` at now. */
	async stopAndStart(task: TimerTask): Promise<void> {
		await this.finish();
		await this.start(task);
	}

	/** Resume a timer from the active entry returned by the server. */
	restore(entry: RestoreEntry): void {
		this.#applyTask({
			id: entry.task_id,
			name: entry.task_name,
			projectName: entry.project_name,
			description: entry.task_description,
		});
		this.activeTimeEntryId = entry.id;
		this.#startedAt = new Date(entry.started_at).getTime();
		this.elapsedSeconds = Math.floor((Date.now() - this.#startedAt) / 1000);
		this.comment = entry.comment ?? '';
		this.#begin();
	}

	async updateStartedAt(newStartedAt: Date): Promise<void> {
		if (!this.activeTimeEntryId) return;
		if (newStartedAt.getTime() > Date.now()) return;
		await this.#api.updateTimeEntry(this.activeTimeEntryId, {
			started_at: newStartedAt.toISOString(),
		});
		this.#startedAt = newStartedAt.getTime();
		this.elapsedSeconds = Math.floor((Date.now() - this.#startedAt) / 1000);
	}

	/** Stop the timer and delete the active entry (undo). */
	async cancelTimer(): Promise<void> {
		this.#clearTimers();
		const entryId = this.activeTimeEntryId;
		this.#clearState();
		if (entryId) {
			await this.#api.deleteTimeEntry(entryId);
		}
	}

	/** Clear all state locally, without touching the server. */
	reset(): void {
		this.#clearTimers();
		this.#clearState();
	}

	setComment(value: string): void {
		this.comment = value;
		if (this.activeTimeEntryId) {
			if (this.#commentTimeout) clearTimeout(this.#commentTimeout);
			this.#commentTimeout = setTimeout(() => {
				if (this.activeTimeEntryId) {
					this.#api.updateTimeEntry(this.activeTimeEntryId, { comment: this.comment || null });
				}
			}, 500);
		}
	}
}
