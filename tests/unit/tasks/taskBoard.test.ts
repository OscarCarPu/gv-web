import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskBoardApi, TaskBoardData } from '$lib/domains/tasks/taskBoard.svelte';
import type { ActiveTreeNode, TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';

function makeTask(over: Partial<TaskByDueDateResponse> = {}): TaskByDueDateResponse {
	return {
		id: 1,
		name: 'Task',
		description: null,
		due_at: null,
		started_at: null,
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		time_spent: 0,
		estimate_hours: null,
		remaining_hours: null,
		start_by: null,
		urgent: false,
		project_id: null,
		project_name: null,
		project_due_at: null,
		depends_on: [],
		blocks: [],
		blocked: false,
		...over,
	};
}

function makeData(over: Partial<TaskBoardData> = {}): TaskBoardData {
	return {
		tasksByDueDate: [],
		activeTree: [],
		...over,
	};
}

function createMockApi(): TaskBoardApi & {
	updateTask: ReturnType<typeof vi.fn>;
	updateProject: ReturnType<typeof vi.fn>;
} {
	return {
		updateTask: vi.fn().mockResolvedValue({}),
		updateProject: vi.fn().mockResolvedValue({}),
	};
}

describe('TaskBoard', () => {
	let TaskBoard: typeof import('$lib/domains/tasks/taskBoard.svelte').TaskBoard;
	let api: ReturnType<typeof createMockApi>;
	let refresh: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
		const module = await import('$lib/domains/tasks/taskBoard.svelte');
		TaskBoard = module.TaskBoard;
		api = createMockApi();
		refresh = vi.fn().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	describe('toggleTask', () => {
		it('start optimistically sets started_at and calls updateTask', async () => {
			const data = makeData({ tasksByDueDate: [makeTask({ id: 1 })] });
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTask(1, 'start');

			expect(data.tasksByDueDate[0].started_at).toBe('2026-03-10T10:00:00.000Z');
			expect(api.updateTask).toHaveBeenCalledWith(1, { started_at: '2026-03-10T10:00:00.000Z' });
			expect(refresh).toHaveBeenCalled();
		});

		it('start rolls back started_at when the API rejects', async () => {
			api.updateTask.mockRejectedValueOnce(new Error('boom'));
			const data = makeData({ tasksByDueDate: [makeTask({ id: 1, started_at: null })] });
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTask(1, 'start');

			expect(data.tasksByDueDate[0].started_at).toBeNull();
			expect(refresh).not.toHaveBeenCalled();
		});

		it('finish adds to pendingTaskIds and calls updateTask with finished_at', async () => {
			const data = makeData({ tasksByDueDate: [makeTask({ id: 7, started_at: 'x' })] });
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTask(7, 'finish');

			expect(api.updateTask).toHaveBeenCalledWith(7, { finished_at: '2026-03-10T10:00:00.000Z' });
			expect(board.pendingTaskIds.has(7)).toBe(true);
		});

		it('finish removes from pendingTaskIds on rejection', async () => {
			api.updateTask.mockRejectedValueOnce(new Error('boom'));
			const data = makeData({ tasksByDueDate: [makeTask({ id: 7, started_at: 'x' })] });
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTask(7, 'finish');

			expect(board.pendingTaskIds.has(7)).toBe(false);
		});

		it('finish on a recurring task renews due_at instead of finishing', async () => {
			const data = makeData({
				tasksByDueDate: [
					makeTask({ id: 9, started_at: 'x', task_type: 'recurring', recurrence: 7 }),
				],
			});
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTask(9, 'finish');

			const call = api.updateTask.mock.calls[0];
			expect(call[0]).toBe(9);
			expect(call[1]).toHaveProperty('due_at');
			expect(call[1]).not.toHaveProperty('finished_at');
			expect(board.pendingTaskIds.has(9)).toBe(false);
		});
	});

	describe('toggleTreeNode', () => {
		it('project finish adds to pendingProjectIds and calls updateProject', async () => {
			const data = makeData({
				activeTree: [{ id: 2, type: 'project', name: 'P', children: [] } as ActiveTreeNode],
			});
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTreeNode(2, 'project', 'finish');

			expect(api.updateProject).toHaveBeenCalledWith(2, {
				finished_at: '2026-03-10T10:00:00.000Z',
			});
			expect(board.pendingProjectIds.has(2)).toBe(true);
		});

		it('task start mutates the nested node and rolls back on rejection', async () => {
			api.updateTask.mockRejectedValueOnce(new Error('boom'));
			const taskNode: ActiveTreeNode = { id: 5, type: 'task', name: 'T', started_at: null };
			const data = makeData({
				activeTree: [{ id: 2, type: 'project', name: 'P', children: [taskNode] } as ActiveTreeNode],
			});
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			await board.toggleTreeNode(5, 'task', 'start');

			expect(taskNode.started_at).toBeNull();
		});
	});

	describe('filters & folding', () => {
		it('filteredByDueDate filters by priority, pending, and project', () => {
			const data = makeData({
				tasksByDueDate: [
					makeTask({ id: 1, priority: 1, project_id: 100 }),
					makeTask({ id: 2, priority: 4, project_id: 100 }),
					makeTask({ id: 3, priority: 1, project_id: 200 }),
				],
				activeTree: [
					{ id: 100, type: 'project', name: 'A', children: [] } as ActiveTreeNode,
					{ id: 200, type: 'project', name: 'B', children: [] } as ActiveTreeNode,
				],
			});
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			board.setDuePriority(2); // keep priority <= 2 → drops id 2
			expect(board.filteredByDueDate.map((t) => t.id)).toEqual([1, 3]);

			board.setDueProject(100); // keep project 100 → drops id 3
			expect(board.filteredByDueDate.map((t) => t.id)).toEqual([1]);

			board.pendingTaskIds.add(1); // optimistically finished → drops id 1
			expect(board.filteredByDueDate.map((t) => t.id)).toEqual([]);
		});

		it('setDuePriority/setDueProject reset the fold count; showMore grows it', () => {
			const tasks = Array.from({ length: 30 }, (_, i) => makeTask({ id: i + 1 }));
			const data = makeData({ tasksByDueDate: tasks });
			const board = new TaskBoard(() => data, refresh as unknown as () => Promise<void>, api);

			expect(board.visibleDueDateTasks.length).toBe(15);
			board.showMore();
			expect(board.visibleDueDateTasks.length).toBe(25);
			board.setDuePriority(null); // resets fold
			expect(board.visibleDueDateTasks.length).toBe(15);
		});
	});
});
