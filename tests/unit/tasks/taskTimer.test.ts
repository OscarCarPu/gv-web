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

describe('TaskTimer', () => {
	let TaskTimer: typeof import('$lib/domains/tasks/taskTimer.svelte').TaskTimer;
	let api: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

		const module = await import('$lib/domains/tasks/taskTimer.svelte');
		TaskTimer = module.TaskTimer;
		api = createMockApi();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('should start with default state', () => {
		const timer = new TaskTimer(api);

		expect(timer.isRunning).toBe(false);
		expect(timer.elapsedSeconds).toBe(0);
		expect(timer.selectedTaskId).toBeNull();
		expect(timer.selectedTaskDisplay).toBeNull();
		expect(timer.activeTimeEntryId).toBeNull();
		expect(timer.formattedTime).toBe('00:00:00');
	});

	it('should format time correctly', () => {
		const timer = new TaskTimer(api);
		timer.startClock();

		vi.advanceTimersByTime(3661_000);
		expect(timer.formattedTime).toBe('01:01:01');
	});

	describe('startClock (no task)', () => {
		it('should start the timer without creating a time entry', () => {
			const timer = new TaskTimer(api);
			timer.startClock();

			expect(timer.isRunning).toBe(true);
			expect(api.createTimeEntry).not.toHaveBeenCalled();
		});

		it('should increment elapsed seconds', () => {
			const timer = new TaskTimer(api);
			timer.startClock();

			vi.advanceTimersByTime(3000);
			expect(timer.elapsedSeconds).toBe(3);
		});
	});

	describe('finish', () => {
		it('should stop the timer and reset state without API call when no time entry', async () => {
			const timer = new TaskTimer(api);
			timer.startClock();
			vi.advanceTimersByTime(5000);

			await timer.finish();

			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
			expect(api.updateTimeEntry).not.toHaveBeenCalled();
		});

		it('should update finished_at when active time entry exists', async () => {
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Task 1' });
			vi.advanceTimersByTime(10_000);

			vi.setSystemTime(new Date('2026-03-10T10:00:10.000Z'));
			await timer.finish();

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

	describe('start — timer not running', () => {
		it('should start timer and create time entry', async () => {
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Task 1', projectName: 'Project A' });

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
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Solo Task' });

			expect(timer.selectedTaskDisplay).toBe('Solo Task');
		});

		it('should format display without project name when null', async () => {
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Solo Task', projectName: null });

			expect(timer.selectedTaskDisplay).toBe('Solo Task');
		});

		it('should not create a second entry when already running', async () => {
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Task 1' });
			api.createTimeEntry.mockClear();

			await timer.start({ id: 2, name: 'Task 2' });

			expect(api.createTimeEntry).not.toHaveBeenCalled();
			expect(timer.selectedTaskId).toBe(1);
		});
	});

	describe('replaceForTaskId — timer running, no entry yet (Assign)', () => {
		it('should assign task and create time entry with backdated started_at', async () => {
			const timer = new TaskTimer(api);
			timer.startClock();
			vi.advanceTimersByTime(30_000);

			vi.setSystemTime(new Date('2026-03-10T10:00:30.000Z'));
			await timer.replaceForTaskId({ id: 5, name: 'Late Task', projectName: 'Proj B' });

			expect(timer.selectedTaskId).toBe(5);
			expect(timer.selectedTaskDisplay).toBe('Late Task - Proj B');
			expect(timer.activeTimeEntryId).toBe(42);
			expect(api.createTimeEntry).toHaveBeenCalledWith({
				task_id: 5,
				started_at: '2026-03-10T10:00:00.000Z',
				comment: null,
			});
		});

		it('should do nothing when not running', async () => {
			const timer = new TaskTimer(api);
			await timer.replaceForTaskId({ id: 5, name: 'Late Task' });

			expect(api.createTimeEntry).not.toHaveBeenCalled();
			expect(api.updateTimeEntry).not.toHaveBeenCalled();
			expect(timer.selectedTaskId).toBeNull();
		});
	});

	describe('replaceForTaskId — timer running, entry already exists (reassign)', () => {
		it('should update existing time entry task_id', async () => {
			api.createTimeEntry.mockResolvedValueOnce({ id: 100 });
			const timer = new TaskTimer(api);

			await timer.start({ id: 1, name: 'Task A', projectName: 'Proj' });
			expect(timer.activeTimeEntryId).toBe(100);

			await timer.replaceForTaskId({ id: 2, name: 'Task B', projectName: 'Proj 2' });

			expect(api.updateTimeEntry).toHaveBeenCalledWith(100, { task_id: 2 });
			expect(timer.selectedTaskId).toBe(2);
			expect(timer.selectedTaskDisplay).toBe('Task B - Proj 2');
			expect(timer.activeTimeEntryId).toBe(100);
		});
	});

	describe('stopAndStart', () => {
		it('should finish the current entry at now and create a new one at now', async () => {
			api.createTimeEntry.mockResolvedValueOnce({ id: 100 });
			const timer = new TaskTimer(api);

			await timer.start({ id: 1, name: 'Task A' });
			expect(timer.activeTimeEntryId).toBe(100);

			api.createTimeEntry.mockResolvedValueOnce({ id: 200 });
			vi.setSystemTime(new Date('2026-03-10T10:02:00.000Z'));
			await timer.stopAndStart({ id: 2, name: 'Task B', projectName: 'Proj 2' });

			// old entry finished at now
			expect(api.updateTimeEntry).toHaveBeenCalledWith(100, {
				finished_at: '2026-03-10T10:02:00.000Z',
				comment: null,
			});
			// new entry started at now
			expect(api.createTimeEntry).toHaveBeenLastCalledWith({
				task_id: 2,
				started_at: '2026-03-10T10:02:00.000Z',
				comment: null,
			});
			expect(timer.isRunning).toBe(true);
			expect(timer.selectedTaskId).toBe(2);
			expect(timer.selectedTaskDisplay).toBe('Task B - Proj 2');
			expect(timer.activeTimeEntryId).toBe(200);
		});
	});

	describe('reset', () => {
		it('should clear all state without calling the API', async () => {
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Task 1', projectName: 'Project A' });
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
			const timer = new TaskTimer(api);
			await timer.start({ id: 1, name: 'Task 1' });
			vi.advanceTimersByTime(3000);
			expect(timer.elapsedSeconds).toBe(3);

			timer.reset();
			vi.advanceTimersByTime(5000);
			expect(timer.elapsedSeconds).toBe(0);
		});
	});

	describe('full flow', () => {
		it('start clock → assign task → reassign → finish', async () => {
			api.createTimeEntry.mockResolvedValueOnce({ id: 77 });
			const timer = new TaskTimer(api);

			// 1. Start clock only
			timer.startClock();
			expect(timer.isRunning).toBe(true);
			expect(timer.activeTimeEntryId).toBeNull();

			// 2. Assign task (backdated create)
			vi.advanceTimersByTime(60_000);
			vi.setSystemTime(new Date('2026-03-10T10:01:00.000Z'));
			await timer.replaceForTaskId({ id: 10, name: 'First', projectName: 'P1' });
			expect(timer.activeTimeEntryId).toBe(77);
			expect(api.createTimeEntry).toHaveBeenCalledWith({
				task_id: 10,
				started_at: '2026-03-10T10:00:00.000Z',
				comment: null,
			});

			// 3. Reassign to another task
			await timer.replaceForTaskId({ id: 20, name: 'Second', projectName: 'P2' });
			expect(api.updateTimeEntry).toHaveBeenCalledWith(77, { task_id: 20 });
			expect(timer.selectedTaskDisplay).toBe('Second - P2');

			// 4. Finish
			vi.setSystemTime(new Date('2026-03-10T10:05:00.000Z'));
			await timer.finish();
			expect(api.updateTimeEntry).toHaveBeenCalledWith(77, {
				finished_at: '2026-03-10T10:05:00.000Z',
				comment: null,
			});
			expect(timer.isRunning).toBe(false);
			expect(timer.elapsedSeconds).toBe(0);
		});
	});
});
