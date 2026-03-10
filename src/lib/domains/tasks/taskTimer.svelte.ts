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
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	function startTimer() {
		timerInterval = setInterval(() => {
			elapsedSeconds++;
		}, 1000);
		isRunning = true;
	}

	async function stopTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;

		if (activeTimeEntryId) {
			await api.updateTimeEntry(activeTimeEntryId, {
				finished_at: new Date().toISOString()
			});
		}

		isRunning = false;
		elapsedSeconds = 0;
		selectedTaskId = null;
		selectedTaskDisplay = null;
		activeTimeEntryId = null;
	}

	async function handleTaskStart(taskId: number, taskName: string, projectName?: string | null) {
		const display = projectName ? `${taskName} - ${projectName}` : taskName;

		if (!isRunning) {
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
			startTimer();
			const entry = await api.createTimeEntry({
				task_id: taskId,
				started_at: new Date().toISOString()
			});
			activeTimeEntryId = entry.id;
		} else if (!activeTimeEntryId) {
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
			const entry = await api.createTimeEntry({
				task_id: taskId,
				started_at: new Date(Date.now() - elapsedSeconds * 1000).toISOString()
			});
			activeTimeEntryId = entry.id;
		} else {
			await api.updateTimeEntry(activeTimeEntryId, { task_id: taskId });
			selectedTaskId = taskId;
			selectedTaskDisplay = display;
		}
	}

	function restore(timeEntryId: number, taskId: number, startedAt: string, taskName: string, projectName?: string | null) {
		selectedTaskId = taskId;
		selectedTaskDisplay = projectName ? `${taskName} - ${projectName}` : taskName;
		activeTimeEntryId = timeEntryId;
		elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
		startTimer();
	}

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
		const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${h}:${m}:${s}`;
	}

	return {
		get selectedTaskId() { return selectedTaskId; },
		get selectedTaskDisplay() { return selectedTaskDisplay; },
		get activeTimeEntryId() { return activeTimeEntryId; },
		get isRunning() { return isRunning; },
		get elapsedSeconds() { return elapsedSeconds; },
		get formattedTime() { return formatTime(elapsedSeconds); },
		startTimer,
		stopTimer,
		handleTaskStart,
		restore
	};
}

export type TaskTimer = ReturnType<typeof createTaskTimer>;
