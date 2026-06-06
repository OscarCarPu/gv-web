import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { toLocalDatetime, toISOString } from '$lib/shared/utils/datetime';
import { planReverseDependsSync } from '$lib/domains/tasks/utils/reverseDepends';
import type {
	TaskFullResponse,
	TodoResponse,
	TaskDepRef,
	ProjectListItem,
} from '$lib/domains/tasks/types/Task.types';

export interface TaskDetailApi {
	getTask: (id: number) => Promise<TaskFullResponse>;
	listProjectsFast: () => Promise<ProjectListItem[]>;
	updateTask: (
		id: number,
		input: {
			name?: string | null;
			description?: string | null;
			due_at?: string | null;
			project_id?: number | null;
			started_at?: string | null;
			finished_at?: string | null;
			depends_on?: number[];
			task_type?: string;
			recurrence?: number | null;
			priority?: number | null;
		}
	) => Promise<unknown>;
	deleteTask: (id: number) => Promise<void>;
	createTodo: (input: { task_id: number; name: string }) => Promise<TodoResponse>;
	updateTodo: (id: number, input: { is_done?: boolean | null }) => Promise<TodoResponse>;
	deleteTodo: (id: number) => Promise<void>;
}

export interface TaskDetailCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns all of `TaskBottomSheet`'s logic: loading the task + projects, hydrating the
 * editable form fields, optimistic start/finish, save (incl. reverse-dep sync via the
 * pure `planReverseDependsSync` planner), delete, and the todo CRUD. Mirrors
 * `TaskTimer` / `TaskBoard`: injected `#api`, injected callbacks, named methods,
 * reactive `$state` form fields read & `bind:`-ed directly by the template.
 */
export class TaskDetail {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: TaskDetailApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;

	// The id currently being edited (set by `load`).
	#taskId = $state<number | null>(null);

	// Loaded data.
	task = $state<TaskFullResponse | null>(null);
	todos = $state<TodoResponse[]>([]);
	projects = $state<ProjectListItem[]>([]);
	projectName = $state<string | null>(null);

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');
	description = $state('');
	dueAt = $state('');
	newTodoName = $state('');
	selectedProjectId = $state<number | null>(null);
	taskType = $state<'standard' | 'continuous' | 'recurring'>('standard');
	recurrence = $state<number | null>(null);
	priority = $state<number>(3);
	dependsOn = $state<TaskDepRef[]>([]);
	blocks = $state<TaskDepRef[]>([]);
	editingDescription = $state(false);

	// View-only flags.
	saving = $state(false);
	nameError = $state(false);

	// Non-template state.
	#initialBlocks = $state<TaskDepRef[]>([]);

	constructor(api: TaskDetailApi = tasksApi, { onclose, refresh }: TaskDetailCallbacks) {
		this.#api = api;
		this.#onclose = onclose;
		this.#refresh = refresh;
	}

	get taskId(): number | null {
		return this.#taskId;
	}

	// ── loading / hydration ─────────────────────────────────────────────

	/**
	 * Point the controller at a task id and load it. Mirrors the component's
	 * previous `$effect`: resets the project display + name-error, then loads.
	 * Passing `null` clears the loaded state.
	 */
	async load(taskId: number | null): Promise<void> {
		this.#taskId = taskId;
		if (taskId != null) {
			this.projectName = null;
			this.selectedProjectId = null;
			this.nameError = false;
			await this.#loadTask();
		} else {
			this.task = null;
			this.projects = [];
		}
	}

	async #loadTask(): Promise<void> {
		const taskId = this.#taskId;
		if (taskId == null) return;
		const [t, ps] = await Promise.all([
			this.#api.getTask(taskId),
			this.projects.length === 0 ? this.#api.listProjectsFast() : Promise.resolve(this.projects),
		]);
		this.task = t;
		this.projects = ps;
		this.todos = TaskDetail.#sortTodos([...t.todos]);
		this.name = t.name;
		this.description = t.description ?? '';
		this.editingDescription = !this.description;
		this.dueAt = toLocalDatetime(t.due_at);
		this.taskType = (t.task_type as 'standard' | 'continuous' | 'recurring') ?? 'standard';
		this.recurrence = t.recurrence ?? null;
		this.priority = t.priority ?? 3;
		this.dependsOn = [...t.depends_on];
		this.blocks = [...t.blocks];
		this.#initialBlocks = [...t.blocks];
		this.selectedProjectId = t.project_id;
		this.projectName = ps.find((p) => p.id === t.project_id)?.name ?? null;
	}

	// ── optimistic lifecycle ────────────────────────────────────────────

	async setStarted(): Promise<void> {
		const id = this.#taskId;
		if (id == null || !this.task) return;
		const now = new Date().toISOString();
		const prev = this.task.started_at;
		this.task.started_at = now;
		addNotification('Task started', 'success');
		try {
			await this.#api.updateTask(id, { started_at: now });
			await Promise.all([this.#loadTask(), this.#refresh()]);
		} catch {
			if (this.task) this.task.started_at = prev;
			addToast('Error starting task', 'error');
		}
	}

	async setFinished(): Promise<void> {
		const id = this.#taskId;
		if (id == null || !this.task) return;
		const now = new Date().toISOString();
		const prev = this.task.finished_at;
		this.task.finished_at = now;
		addNotification('Task finished', 'success');
		try {
			await this.#api.updateTask(id, { finished_at: now });
			await Promise.all([this.#loadTask(), this.#refresh()]);
		} catch {
			if (this.task) this.task.finished_at = prev;
			addToast('Error finishing task', 'error');
		}
	}

	// ── save ────────────────────────────────────────────────────────────

	async save(): Promise<void> {
		const taskId = this.#taskId;
		if (taskId == null) return;
		if (!this.name.trim()) {
			this.nameError = true;
			return;
		}
		this.saving = true;
		try {
			await Promise.all([
				this.#api.updateTask(taskId, {
					name: this.name,
					description: this.description || null,
					due_at: toISOString(this.dueAt),
					depends_on: this.dependsOn.map((d) => d.id),
					task_type: this.taskType,
					recurrence: this.taskType === 'recurring' ? this.recurrence : undefined,
					priority: this.priority,
					project_id: this.selectedProjectId,
				}),
				this.#syncReverseDepends(),
			]);
			addNotification('Task updated', 'success');
			await this.#refresh();
			this.#onclose();
		} catch {
			addToast('Error saving task', 'error');
		} finally {
			this.saving = false;
		}
	}

	async #syncReverseDepends(): Promise<void> {
		const taskId = this.#taskId;
		if (taskId == null) return;
		const updates = await planReverseDependsSync(taskId, this.#initialBlocks, this.blocks, (id) =>
			this.#api.getTask(id)
		);
		await Promise.all(updates.map((u) => this.#api.updateTask(u.id, { depends_on: u.depends_on })));
	}

	// ── delete ──────────────────────────────────────────────────────────

	async remove(): Promise<void> {
		const id = this.#taskId;
		if (id == null) return;
		this.#onclose();
		addNotification('Task deleted', 'success');
		try {
			await this.#api.deleteTask(id);
			await this.#refresh();
		} catch {
			addToast('Error deleting task', 'error');
			await this.#refresh();
		}
	}

	// ── todos ───────────────────────────────────────────────────────────

	static #sortTodos(list: TodoResponse[]): TodoResponse[] {
		return list.sort((a, b) => Number(a.is_done) - Number(b.is_done));
	}

	async toggleTodo(todo: TodoResponse): Promise<void> {
		const newDone = !todo.is_done;
		this.todos = TaskDetail.#sortTodos(
			this.todos.map((t) => (t.id === todo.id ? { ...t, is_done: newDone } : t))
		);
		addNotification(newDone ? 'Todo completed' : 'Todo pending', 'success');
		try {
			const updated = await this.#api.updateTodo(todo.id, { is_done: newDone });
			this.todos = TaskDetail.#sortTodos(
				this.todos.map((t) => (t.id === updated.id ? updated : t))
			);
		} catch {
			this.todos = TaskDetail.#sortTodos(this.todos.map((t) => (t.id === todo.id ? todo : t)));
			addToast('Error updating todo', 'error');
		}
	}

	async deleteTodo(id: number): Promise<void> {
		const removed = this.todos.find((t) => t.id === id);
		this.todos = this.todos.filter((t) => t.id !== id);
		addNotification('Todo deleted', 'success');
		try {
			await this.#api.deleteTodo(id);
		} catch {
			if (removed) this.todos = TaskDetail.#sortTodos([...this.todos, removed]);
			addToast('Error deleting todo', 'error');
		}
	}

	async addTodo(): Promise<void> {
		const taskId = this.#taskId;
		if (!this.newTodoName.trim() || taskId == null) return;
		const id = taskId;
		const name = this.newTodoName.trim();
		const tempId = -Date.now();
		const optimistic: TodoResponse = { id: tempId, task_id: id, name, is_done: false };
		this.todos = [...this.todos, optimistic];
		this.newTodoName = '';
		addNotification('Todo added', 'success');
		try {
			const created = await this.#api.createTodo({ task_id: id, name });
			this.todos = this.todos.map((t) => (t.id === tempId ? created : t));
		} catch {
			this.todos = this.todos.filter((t) => t.id !== tempId);
			addToast('Error adding todo', 'error');
		}
	}
}
