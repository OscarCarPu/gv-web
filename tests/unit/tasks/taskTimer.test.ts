import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskTimerApi } from '$lib/domains/tasks/taskTimer.svelte';

function createMockApi(): TaskTimerApi & {
	createTimeEntry: ReturnType<typeof vi.fn>;
	updateTimeEntry: ReturnType<typeof vi.fn>;
	deleteTimeEntry: ReturnType<typeof vi.fn>;
} {
	return {
		createTimeEntry: vi.fn().mockResolvedValue({ id: 42 }),
		updateTimeEntry: vi.fn().mockResolvedValue({}),
		deleteTimeEntry: vi.fn().mockResolvedValue(undefined),
	};
}

describe('createTaskTimer', () => {
	let createTaskTimer: typeof import('$lib/domains/tasks/taskTimer.svelte').createTaskTimer;
	let api: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

		const module = await import('$lib/domains/tasks/taskTimer.svelte');
		createTaskTimer = module.createTaskTimer;
		api = createMockApi();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('should start with default state', () => {
		const timer = createTaskTimer(api);

		expect(timer.isRunning).toBe(false);
		expect(timer.elapsedSeconds).toBe(0);
		expect(timer.selectedTaskId).toBeNull();
		expect(timer.selectedTaskDisplay).toBeNull();
		expect(timer.activeTimeEntryId).toBeNull();
		expect(timer.formattedTime).toBe('00:00:00');
	});

	it('should format time correctly', () => {
		const timer = createTaskTimer(api);
		timer.startTimer();

		vi.advanceTimersByTime(3661_000);
		expect(timer.formattedTime).toBe('01:01:01');
	});

	describe('startTimer (no task)', () => {
		it('should start the timer without creating a time entry', () => {
			const timer = createTaskTimer(api);
			timer.startTimer();

			expect(timer.isRunning).toBe(true);
			expect(api.createTimeEntry).not.toHaveBeenCalled();
		});

		it('should increment elapsed seconds', () => {
			const timer = createTaskTimer(api);
			timer.startTimer();

			vi.advanceTimersByTime(3000);
			expect(timer.elapsedSeconds).toBe(3);
		});
	});

	describe('stopTimer', () => {
		it('should stop the timer and reset state without API call when no time entry', async () => {
			const timer = createTaskTimer(api);
			timer.startTimer();
			vi.advanceTimersByTime(5000);

			await timer.stopTimer();

			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
			expect(api.updateTimeEntry).not.toHaveBeenCalled();
		});

		it('should update finished_at when active time entry exists', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Task 1');
			vi.advanceTimersByTime(10_000);

			vi.setSystemTime(new Date('2026-03-10T10:00:10.000Z'));
			await timer.stopTimer();

			expect(api.updateTimeEntry).toHaveBeenCalledWith(42, {
				finished_at: '2026-03-10T10:00:10.000Z',
				comment: null,
			});
			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
			expect(timer.selectedTaskId).toBeNull();
			expect(timer.selectedTaskDisplay).toBeNull();
			expect(timer.activeTimeEntryId).toBeNull();
		});
	});

	describe('handleTaskStart — timer not running', () => {
		it('should start timer and create time entry', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Task 1', 'Project A');

			expect(timer.isRunning).toBe(true);
			expect(timer.selectedTaskId).toBe(1);
			expect(timer.selectedTaskDisplay).toBe('Task 1 - Project A');
			expect(timer.activeTimeEntryId).toBe(42);
			expect(api.createTimeEntry).toHaveBeenCalledWith({
				task_id: 1,
				started_at: '2026-03-10T10:00:00.000Z',
				comment: null,
			});
		});

		it('should format display without project name', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Solo Task');

			expect(timer.selectedTaskDisplay).toBe('Solo Task');
		});

		it('should format display without project name when null', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Solo Task', null);

			expect(timer.selectedTaskDisplay).toBe('Solo Task');
		});
	});

	describe('handleTaskStart — timer running, no task assigned (Asignar)', () => {
		it('should assign task and create time entry with backdated started_at', async () => {
			const timer = createTaskTimer(api);
			timer.startTimer();
			vi.advanceTimersByTime(30_000);

			vi.setSystemTime(new Date('2026-03-10T10:00:30.000Z'));
			await timer.handleTaskStart(5, 'Late Task', 'Proj B');

			expect(timer.selectedTaskId).toBe(5);
			expect(timer.selectedTaskDisplay).toBe('Late Task - Proj B');
			expect(timer.activeTimeEntryId).toBe(42);
			expect(api.createTimeEntry).toHaveBeenCalledWith({
				task_id: 5,
				started_at: '2026-03-10T10:00:00.000Z',
				comment: null,
			});
		});
	});

	describe('handleTaskStart — timer running, task already assigned (reassign)', () => {
		it('should update existing time entry task_id', async () => {
			api.createTimeEntry.mockResolvedValueOnce({ id: 100 });
			const timer = createTaskTimer(api);

			await timer.handleTaskStart(1, 'Task A', 'Proj');
			expect(timer.activeTimeEntryId).toBe(100);

			await timer.handleTaskStart(2, 'Task B', 'Proj 2');

			expect(api.updateTimeEntry).toHaveBeenCalledWith(100, { task_id: 2 });
			expect(timer.selectedTaskId).toBe(2);
			expect(timer.selectedTaskDisplay).toBe('Task B - Proj 2');
			expect(timer.activeTimeEntryId).toBe(100);
		});
	});

	describe('reset', () => {
		it('should clear all state without calling the API', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Task 1', 'Project A');
			vi.advanceTimersByTime(5000);

			expect(timer.isRunning).toBe(true);
			expect(timer.activeTimeEntryId).toBe(42);

			api.updateTimeEntry.mockClear();
			timer.reset();

			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
			expect(timer.selectedTaskId).toBeNull();
			expect(timer.selectedTaskDisplay).toBeNull();
			expect(timer.activeTimeEntryId).toBeNull();
			expect(api.updateTimeEntry).not.toHaveBeenCalled();
		});

		it('should stop the interval so elapsed seconds no longer increment', async () => {
			const timer = createTaskTimer(api);
			await timer.handleTaskStart(1, 'Task 1');
			vi.advanceTimersByTime(3000);
			expect(timer.elapsedSeconds).toBe(3);

			timer.reset();
			vi.advanceTimersByTime(5000);
			expect(timer.elapsedSeconds).toBe(0);
		});
	});

	describe('full flow', () => {
		it('start timer → assign task → reassign → stop', async () => {
			api.createTimeEntry.mockResolvedValueOnce({ id: 77 });
			const timer = createTaskTimer(api);

			// 1. Start timer only
			timer.startTimer();
			expect(timer.isRunning).toBe(true);
			expect(timer.activeTimeEntryId).toBeNull();

			// 2. Assign task (Asignar)
			vi.advanceTimersByTime(60_000);
			vi.setSystemTime(new Date('2026-03-10T10:01:00.000Z'));
			await timer.handleTaskStart(10, 'First', 'P1');
			expect(timer.activeTimeEntryId).toBe(77);
			expect(api.createTimeEntry).toHaveBeenCalledWith({
				task_id: 10,
				started_at: '2026-03-10T10:00:00.000Z',
				comment: null,
			});

			// 3. Reassign to another task
			await timer.handleTaskStart(20, 'Second', 'P2');
			expect(api.updateTimeEntry).toHaveBeenCalledWith(77, { task_id: 20 });
			expect(timer.selectedTaskDisplay).toBe('Second - P2');

			// 4. Stop
			vi.setSystemTime(new Date('2026-03-10T10:05:00.000Z'));
			await timer.stopTimer();
			expect(api.updateTimeEntry).toHaveBeenCalledWith(77, {
				finished_at: '2026-03-10T10:05:00.000Z',
				comment: null,
			});
			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
		});
	});
});
