import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskDetailApi } from '$lib/domains/tasks/taskDetail.svelte';
import type {
	TaskFullResponse,
	TodoResponse,
	TaskDepRef,
} from '$lib/domains/tasks/types/Task.types';

function makeFull(over: Partial<TaskFullResponse> = {}): TaskFullResponse {
	return {
		id: 1,
		project_id: null,
		name: 'Task',
		description: null,
		due_at: null,
		started_at: null,
		finished_at: null,
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		estimate_hours: null,
		time_spent: 0,
		todos: [],
		depends_on: [],
		blocks: [],
		blocked: false,
		...over,
	};
}

function dep(id: number): TaskDepRef {
	return { id, name: `Task ${id}`, due_at: null };
}

function createMockApi(task: TaskFullResponse): TaskDetailApi & {
	getTask: ReturnType<typeof vi.fn>;
	listProjectsFast: ReturnType<typeof vi.fn>;
	updateTask: ReturnType<typeof vi.fn>;
	deleteTask: ReturnType<typeof vi.fn>;
	createTodo: ReturnType<typeof vi.fn>;
	updateTodo: ReturnType<typeof vi.fn>;
	deleteTodo: ReturnType<typeof vi.fn>;
} {
	return {
		getTask: vi.fn().mockResolvedValue(task),
		listProjectsFast: vi.fn().mockResolvedValue([]),
		updateTask: vi.fn().mockResolvedValue({}),
		deleteTask: vi.fn().mockResolvedValue(undefined),
		createTodo: vi.fn().mockResolvedValue({ id: 0, task_id: 1, name: '', is_done: false }),
		updateTodo: vi.fn().mockResolvedValue({ id: 0, task_id: 1, name: '', is_done: false }),
		deleteTodo: vi.fn().mockResolvedValue(undefined),
	};
}

describe('TaskDetail', () => {
	let TaskDetail: typeof import('$lib/domains/tasks/taskDetail.svelte').TaskDetail;
	let onclose: ReturnType<typeof vi.fn> & (() => void);
	let refresh: ReturnType<typeof vi.fn> & (() => Promise<void>);

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
		const module = await import('$lib/domains/tasks/taskDetail.svelte');
		TaskDetail = module.TaskDetail;
		onclose = vi.fn() as unknown as ReturnType<typeof vi.fn> & (() => void);
		refresh = vi.fn().mockResolvedValue(undefined) as unknown as ReturnType<typeof vi.fn> &
			(() => Promise<void>);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	describe('load', () => {
		it('hydrates form fields from the fetched task', async () => {
			const task = makeFull({
				id: 1,
				name: 'Hello',
				description: 'desc',
				priority: 2,
				task_type: 'recurring',
				recurrence: 7,
				project_id: null,
				depends_on: [dep(3)],
				blocks: [dep(4)],
			});
			const api = createMockApi(task);
			const detail = new TaskDetail(api, { onclose, refresh });

			await detail.load(1);

			expect(detail.name).toBe('Hello');
			expect(detail.description).toBe('desc');
			expect(detail.priority).toBe(2);
			expect(detail.taskType).toBe('recurring');
			expect(detail.recurrence).toBe(7);
			expect(detail.dependsOn).toEqual([dep(3)]);
			expect(detail.blocks).toEqual([dep(4)]);
			// editingDescription false because description is non-empty.
			expect(detail.editingDescription).toBe(false);
		});

		it('load(null) clears the task', async () => {
			const api = createMockApi(makeFull());
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			expect(detail.task).not.toBeNull();

			await detail.load(null);
			expect(detail.task).toBeNull();
		});
	});

	describe('setStarted', () => {
		it('optimistically sets started_at, calls updateTask, reloads + refreshes', async () => {
			const api = createMockApi(makeFull({ id: 1, started_at: null }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.setStarted();

			expect(api.updateTask).toHaveBeenCalledWith(1, { started_at: '2026-03-10T10:00:00.000Z' });
			expect(refresh).toHaveBeenCalled();
		});

		it('rolls back started_at when the API rejects', async () => {
			const api = createMockApi(makeFull({ id: 1, started_at: null }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			api.updateTask.mockRejectedValueOnce(new Error('boom'));

			await detail.setStarted();

			expect(detail.task?.started_at).toBeNull();
		});
	});

	describe('setFinished', () => {
		it('rolls back finished_at when the API rejects', async () => {
			const api = createMockApi(makeFull({ id: 1, finished_at: null }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			api.updateTask.mockRejectedValueOnce(new Error('boom'));

			await detail.setFinished();

			expect(detail.task?.finished_at).toBeNull();
		});
	});

	describe('save', () => {
		it('blocks save with an empty name and sets nameError', async () => {
			const api = createMockApi(makeFull({ id: 1, name: 'X' }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			detail.name = '   ';

			await detail.save();

			expect(detail.nameError).toBe(true);
			expect(api.updateTask).not.toHaveBeenCalled();
			expect(onclose).not.toHaveBeenCalled();
		});

		it('sends the update, runs reverse-dep sync, refreshes and closes', async () => {
			// Task 1 starts with blocks [], we add block on task 2 (which depends on [5]).
			const api = createMockApi(makeFull({ id: 1, blocks: [] }));
			api.getTask.mockImplementation(async (id: number) => {
				if (id === 1) return makeFull({ id: 1, blocks: [] });
				return makeFull({ id, depends_on: [dep(5)] });
			});
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			detail.blocks = [dep(2)];

			await detail.save();

			// main update
			expect(api.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Task' }));
			// reverse-dep update: task 2 now depends on [5, 1]
			expect(api.updateTask).toHaveBeenCalledWith(2, { depends_on: [5, 1] });
			expect(refresh).toHaveBeenCalled();
			expect(onclose).toHaveBeenCalled();
		});

		it('recurring omits recurrence when type is not recurring', async () => {
			const api = createMockApi(makeFull({ id: 1, task_type: 'standard' }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.save();

			const call = api.updateTask.mock.calls.find((c) => c[0] === 1);
			expect(call?.[1].recurrence).toBeUndefined();
		});
	});

	describe('remove', () => {
		it('closes immediately, deletes, then refreshes', async () => {
			const api = createMockApi(makeFull({ id: 1 }));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.remove();

			expect(onclose).toHaveBeenCalled();
			expect(api.deleteTask).toHaveBeenCalledWith(1);
			expect(refresh).toHaveBeenCalled();
		});
	});

	describe('todos', () => {
		it('toggleTodo optimistically flips, then reconciles with the server result', async () => {
			const todo: TodoResponse = { id: 10, task_id: 1, name: 'todo', is_done: false };
			const api = createMockApi(makeFull({ id: 1, todos: [todo] }));
			api.updateTodo.mockResolvedValue({ ...todo, is_done: true });
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.toggleTodo(todo);

			expect(api.updateTodo).toHaveBeenCalledWith(10, { is_done: true });
			expect(detail.todos.find((t) => t.id === 10)?.is_done).toBe(true);
		});

		it('toggleTodo rolls back on error', async () => {
			const todo: TodoResponse = { id: 10, task_id: 1, name: 'todo', is_done: false };
			const api = createMockApi(makeFull({ id: 1, todos: [todo] }));
			api.updateTodo.mockRejectedValueOnce(new Error('boom'));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.toggleTodo(todo);

			expect(detail.todos.find((t) => t.id === 10)?.is_done).toBe(false);
		});

		it('addTodo appends an optimistic todo then swaps in the created one', async () => {
			const api = createMockApi(makeFull({ id: 1, todos: [] }));
			api.createTodo.mockResolvedValue({ id: 99, task_id: 1, name: 'new', is_done: false });
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);
			detail.newTodoName = 'new';

			await detail.addTodo();

			expect(api.createTodo).toHaveBeenCalledWith({ task_id: 1, name: 'new' });
			expect(detail.todos.map((t) => t.id)).toEqual([99]);
			expect(detail.newTodoName).toBe('');
		});

		it('deleteTodo removes the todo and restores it on error', async () => {
			const todo: TodoResponse = { id: 10, task_id: 1, name: 'todo', is_done: false };
			const api = createMockApi(makeFull({ id: 1, todos: [todo] }));
			api.deleteTodo.mockRejectedValueOnce(new Error('boom'));
			const detail = new TaskDetail(api, { onclose, refresh });
			await detail.load(1);

			await detail.deleteTodo(10);

			expect(detail.todos.map((t) => t.id)).toEqual([10]);
		});
	});
});
