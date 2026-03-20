import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import type { CreateTimeEntryRequest, UpdateTimeEntryRequest } from '$lib/domains/tasks/types/Task.types';

export interface TaskTimerApi {
	createTimeEntry: (input: CreateTimeEntryRequest) => Promise<{ id: number }>;
	updateTimeEntry: (id: number, input: UpdateTimeEntryRequest) => Promise<unknown>;
}

export interface TaskTimerState {
	selectedTaskId: number | null;
	selectedTaskDisplay: string | null;
	activeTimeEntryId: number | null;
	isRunning: boolean;
	elapsedSeconds: number;
}

export function createTaskTimer(api: TaskTimerApi = tasksApi) {
	let selectedTaskId: number | null = $state(null);
	let selectedTaskDisplay: string | null = $state(null);
	let activeTimeEntryId: number | null = $state(null);
	let isRunning = $state(false);
	let elapsedSeconds = $state(0);
	let comment = $state('');
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let startedAt: number | null = null;

	function startTimer() {
		if (startedAt === null) {
			startedAt = Date.now();
		}
		timerInterval = setInterval(() => {
			elapsedSeconds = Math.floor((Date.now() - startedAt!) / 1000);
		}, 1000);
		isRunning = true;
	}

	async function stopTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;

		if (activeTimeEntryId) {
			await api.updateTimeEntry(activeTimeEntryId, {
				finished_at: new Date().toISOString(),
				comment: comment || null
			});
		}

		isRunning = false;
		elapsedSeconds = 0;
		startedAt = null;
		selectedTaskId = null;
		selectedTaskDisplay = null;
		activeTimeEntryId = null;
		comment = '';
	}

	async function handleTaskStart(taskId: number, taskName: string, projectName?: string | null) {
		const display = projectName ? `${taskName} - ${projectName}` : taskName;

		if (!isRunning) {
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
			startedAt = Date.now();
			startTimer();
			const entry = await api.createTimeEntry({
				task_id: taskId,
				started_at: new Date(startedAt).toISOString(),
				comment: comment || null
			});
			activeTimeEntryId = entry.id;
		} else if (!activeTimeEntryId) {
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
			const entry = await api.createTimeEntry({
				task_id: taskId,
				started_at: new Date(startedAt!).toISOString(),
				comment: comment || null
			});
			activeTimeEntryId = entry.id;
		} else {
			await api.updateTimeEntry(activeTimeEntryId, { task_id: taskId });
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
		}
	}

	function restore(timeEntryId: number, taskId: number, entryStartedAt: string, taskName: string, projectName?: string | null) {
		selectedTaskId = taskId;
		selectedTaskDisplay = projectName ? `${taskName} - ${projectName}` : taskName;
		activeTimeEntryId = timeEntryId;
		startedAt = new Date(entryStartedAt).getTime();
		elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
		startTimer();
	}

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
		const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${h}:${m}:${s}`;
	}

	async function updateStartedAt(newStartedAt: Date) {
		if (!activeTimeEntryId) return;
		if (newStartedAt.getTime() > Date.now()) return;
		const iso = newStartedAt.toISOString();
		await api.updateTimeEntry(activeTimeEntryId, { started_at: iso });
		startedAt = newStartedAt.getTime();
		elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
	}

	function reset() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
		isRunning = false;
		elapsedSeconds = 0;
		startedAt = null;
		selectedTaskId = null;
		selectedTaskDisplay = null;
		activeTimeEntryId = null;
		comment = '';
	}

	return {
		get selectedTaskId() { return selectedTaskId; },
		get selectedTaskDisplay() { return selectedTaskDisplay; },
		get activeTimeEntryId() { return activeTimeEntryId; },
		get isRunning() { return isRunning; },
		get elapsedSeconds() { return elapsedSeconds; },
		get formattedTime() { return formatTime(elapsedSeconds); },
		get startedAtDate() { return startedAt ? new Date(startedAt) : null; },
		get comment() { return comment; },
		setComment(value: string) { comment = value; },
		startTimer,
		stopTimer,
		handleTaskStart,
		restore,
		updateStartedAt,
		reset,
	};
}

export type TaskTimer = ReturnType<typeof createTaskTimer>;
