<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import {
		toLocalDatetime,
		toISOString,
		formatTime,
		formatDateFull,
	} from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import type {
		TaskFullResponse,
		TodoResponse,
		TaskDepRef,
		ProjectListItem,
	} from '$lib/domains/tasks/types/Task.types';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import DepSelector from './DepSelector.svelte';
	import { linkify } from '$shared/utils/linkify';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		taskId: number | null;
		onclose: () => void;
	}

	let { taskId, onclose }: Props = $props();

	let task = $state<TaskFullResponse | null>(null);
	let todos = $state<TodoResponse[]>([]);
	let name = $state('');
	let description = $state('');
	let dueAt = $state('');
	let newTodoName = $state('');
	let projectName = $state<string | null>(null);
	let projects = $state<ProjectListItem[]>([]);
	let selectedProjectId = $state<number | null>(null);
	let saving = $state(false);
	let nameError = $state(false);
	let taskType = $state<'standard' | 'continuous' | 'recurring'>('standard');
	let recurrence = $state<number | null>(null);
	let priority = $state<number>(3);
	let dependsOn = $state<TaskDepRef[]>([]);
	let blocks = $state<TaskDepRef[]>([]);
	let initialBlocks = $state<TaskDepRef[]>([]);
	let editingDescription = $state(false);

	async function loadTask() {
		if (taskId == null) return;
		const [t, ps] = await Promise.all([
			tasksApi.getTask(taskId),
			projects.length === 0 ? tasksApi.listProjectsFast() : Promise.resolve(projects),
		]);
		task = t;
		projects = ps;
		todos = sortTodos([...t.todos]);
		name = t.name;
		description = t.description ?? '';
		editingDescription = !description;
		dueAt = toLocalDatetime(t.due_at);
		taskType = (t.task_type as 'standard' | 'continuous' | 'recurring') ?? 'standard';
		recurrence = t.recurrence ?? null;
		priority = t.priority ?? 3;
		dependsOn = [...t.depends_on];
		blocks = [...t.blocks];
		initialBlocks = [...t.blocks];
		selectedProjectId = t.project_id;
		projectName = ps.find((p) => p.id === t.project_id)?.name ?? null;
	}

	$effect(() => {
		if (taskId != null) {
			projectName = null;
			selectedProjectId = null;
			nameError = false;
			loadTask();
		} else {
			task = null;
			projects = [];
		}
	});

	async function setStarted() {
		if (taskId == null || !task) return;
		const id = taskId;
		const now = new Date().toISOString();
		const prev = task.started_at;
		task.started_at = now;
		addNotification('Task started', 'success');
		try {
			await tasksApi.updateTask(id, { started_at: now });
			await Promise.all([loadTask(), invalidateAll()]);
		} catch {
			if (task) task.started_at = prev;
			addToast('Error starting task', 'error');
		}
	}

	async function setFinished() {
		if (taskId == null || !task) return;
		const id = taskId;
		const now = new Date().toISOString();
		const prev = task.finished_at;
		task.finished_at = now;
		addNotification('Task finished', 'success');
		try {
			await tasksApi.updateTask(id, { finished_at: now });
			await Promise.all([loadTask(), invalidateAll()]);
		} catch {
			if (task) task.finished_at = prev;
			addToast('Error finishing task', 'error');
		}
	}

	async function save() {
		if (taskId == null) return;
		if (!name.trim()) {
			nameError = true;
			return;
		}
		saving = true;
		try {
			await Promise.all([
				tasksApi.updateTask(taskId, {
					name,
					description: description || null,
					due_at: toISOString(dueAt),
					depends_on: dependsOn.map((d) => d.id),
					task_type: taskType,
					recurrence: taskType === 'recurring' ? recurrence : undefined,
					priority,
					project_id: selectedProjectId,
				}),
				syncReverseDepends(),
			]);
			addNotification('Task updated', 'success');
			await invalidateAll();
			onclose();
		} catch {
			addToast('Error saving task', 'error');
		} finally {
			saving = false;
		}
	}

	async function syncReverseDepends() {
		if (taskId == null) return;
		const initialIds = new Set(initialBlocks.map((d) => d.id));
		const currentIds = new Set(blocks.map((d) => d.id));
		const added = blocks.filter((d) => !initialIds.has(d.id));
		const removed = initialBlocks.filter((d) => !currentIds.has(d.id));
		if (added.length === 0 && removed.length === 0) return;

		const targets = [...added, ...removed];
		const fetched = await Promise.all(targets.map((d) => tasksApi.getTask(d.id)));
		const updates: Promise<unknown>[] = [];
		for (let i = 0; i < added.length; i++) {
			const otherDeps = fetched[i].depends_on.map((d) => d.id);
			if (!otherDeps.includes(taskId)) {
				updates.push(tasksApi.updateTask(added[i].id, { depends_on: [...otherDeps, taskId] }));
			}
		}
		for (let i = 0; i < removed.length; i++) {
			const other = fetched[added.length + i];
			const otherDeps = other.depends_on.map((d) => d.id).filter((id) => id !== taskId);
			updates.push(tasksApi.updateTask(removed[i].id, { depends_on: otherDeps }));
		}
		await Promise.all(updates);
	}

	async function remove() {
		if (taskId == null) return;
		const id = taskId;
		onclose();
		addNotification('Task deleted', 'success');
		try {
			await tasksApi.deleteTask(id);
			await invalidateAll();
		} catch {
			addToast('Error deleting task', 'error');
			await invalidateAll();
		}
	}

	function sortTodos(list: TodoResponse[]): TodoResponse[] {
		return list.sort((a, b) => Number(a.is_done) - Number(b.is_done));
	}

	async function toggleTodo(todo: TodoResponse) {
		const newDone = !todo.is_done;
		todos = sortTodos(todos.map((t) => (t.id === todo.id ? { ...t, is_done: newDone } : t)));
		addNotification(newDone ? 'Todo completed' : 'Todo pending', 'success');
		try {
			const updated = await tasksApi.updateTodo(todo.id, { is_done: newDone });
			todos = sortTodos(todos.map((t) => (t.id === updated.id ? updated : t)));
		} catch {
			todos = sortTodos(todos.map((t) => (t.id === todo.id ? todo : t)));
			addToast('Error updating todo', 'error');
		}
	}

	async function deleteTodo(id: number) {
		const removed = todos.find((t) => t.id === id);
		todos = todos.filter((t) => t.id !== id);
		addNotification('Todo deleted', 'success');
		try {
			await tasksApi.deleteTodo(id);
		} catch {
			if (removed) todos = sortTodos([...todos, removed]);
			addToast('Error deleting todo', 'error');
		}
	}

	async function addTodo() {
		if (!newTodoName.trim() || taskId == null) return;
		const id = taskId;
		const name = newTodoName.trim();
		const tempId = -Date.now();
		const optimistic: TodoResponse = { id: tempId, task_id: id, name, is_done: false };
		todos = [...todos, optimistic];
		newTodoName = '';
		addNotification('Todo added', 'success');
		try {
			const created = await tasksApi.createTodo({ task_id: id, name });
			todos = todos.map((t) => (t.id === tempId ? created : t));
		} catch {
			todos = todos.filter((t) => t.id !== tempId);
			addToast('Error adding todo', 'error');
		}
	}

	function goToProject() {
		if (task?.project_id) {
			onclose();
			goto(`/tasks/projects/${task.project_id}`);
		}
	}
</script>

<BottomSheet open={taskId != null && task != null} {onclose} constrained>
	{#if task}
		<div class="detail-title-row">
			{#if task.project_id && projectName}
				<button class="project-link-inline" onclick={goToProject}>
					<Icon name="folder" />
					{projectName}
				</button>
			{/if}
			<h3 class="modal-title">Task details</h3>
		</div>

		<div class="detail-form">
			<div class="detail-inline-row">
				<div class="detail-field flex-1">
					<label for="task-name">Name</label>
					<input
						id="task-name"
						type="text"
						bind:value={name}
						maxlength={40}
						class:field-error={nameError}
						oninput={() => (nameError = false)}
					/>
				</div>
				<div class="detail-field">
					<label for="dtp-task-due">Due date</label>
					<DatetimePicker bind:value={dueAt} id="task-due" />
				</div>
				<div class="detail-field">
					<label for="task-project">Project</label>
					<select id="task-project" bind:value={selectedProjectId}>
						<option value={null}>No project</option>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="detail-field">
					<label for="task-type">Type</label>
					<select id="task-type" bind:value={taskType}>
						<option value="standard">Standard</option>
						<option value="continuous">Continuous</option>
						<option value="recurring">Recurring</option>
					</select>
				</div>
				{#if taskType === 'recurring'}
					<div class="detail-field">
						<label for="task-recurrence">Every (days)</label>
						<input id="task-recurrence" type="number" min="1" bind:value={recurrence} />
					</div>
				{/if}
				<div class="detail-field">
					<label for="task-priority">Priority</label>
					<select id="task-priority" bind:value={priority}>
						<option value={1}>1 · Urgent</option>
						<option value={2}>2 · High</option>
						<option value={3}>3 · Medium</option>
						<option value={4}>4 · Low</option>
						<option value={5}>5 · Very low</option>
					</select>
				</div>
			</div>
			<div class="detail-field">
				<div class="detail-field-header">
					<label for="task-desc">Description</label>
					{#if description && !editingDescription}
						<button
							type="button"
							class="desc-edit-btn"
							onclick={() => (editingDescription = true)}
							aria-label="Edit description"
						>
							<Icon name="pen" />
						</button>
					{/if}
				</div>
				{#if editingDescription}
					<textarea
						id="task-desc"
						bind:value={description}
						rows="2"
						onblur={() => {
							if (description) editingDescription = false;
						}}
					></textarea>
				{:else}
					<div class="desc-view">{@html linkify(description)}</div>
				{/if}
			</div>

			<div class="detail-info-row">
				<div class="detail-info-item">
					<span class="detail-info-label">Start</span>
					{#if task.started_at}
						<span class="detail-info-value">{formatDateFull(task.started_at)}</span>
					{:else}
						<button class="btn-action-sm btn-start" onclick={setStarted}>Start</button>
					{/if}
				</div>
				<div class="detail-info-item">
					<span class="detail-info-label">End</span>
					{#if task.finished_at}
						<span class="detail-info-value">{formatDateFull(task.finished_at)}</span>
					{:else}
						<button class="btn-action-sm" onclick={setFinished}>Finish</button>
					{/if}
				</div>
				{#if task.time_spent > 0}
					<div class="detail-info-item">
						<span class="detail-info-label">Time</span>
						<span class="detail-info-value">{formatTime(task.time_spent)}</span>
					</div>
				{/if}
			</div>

			<div class="detail-inline-row">
				<div class="flex-1">
					<DepSelector
						selected={dependsOn}
						onchange={(deps) => (dependsOn = deps)}
						excludeId={taskId!}
						label="Depends on"
						projectId={task?.project_id}
					/>
				</div>
				<div class="flex-1">
					<DepSelector
						selected={blocks}
						onchange={(deps) => (blocks = deps)}
						excludeId={taskId!}
						label="Blocks"
						projectId={task?.project_id}
					/>
				</div>
			</div>

			<div class="detail-field">
				<span class="label text-text-muted text-sm font-medium">Todos</span>
				<div class="todo-list">
					{#each todos as todo (todo.id)}
						<div class="todo-item">
							<input type="checkbox" checked={todo.is_done} onchange={() => toggleTodo(todo)} />
							<span class:line-through={todo.is_done}>{todo.name}</span>
							<button
								class="btn-danger btn-sm ml-auto"
								onclick={() => deleteTodo(todo.id)}
								aria-label="Delete todo"
							>
								<Icon name="trash" />
							</button>
						</div>
					{/each}
				</div>
				<div class="todo-add">
					<input
						type="text"
						placeholder="New todo..."
						bind:value={newTodoName}
						onkeydown={(e) => e.key === 'Enter' && addTodo()}
					/>
					<button class="btn-primary btn-sm" onclick={addTodo}>Add</button>
				</div>
			</div>

			<div class="detail-actions">
				<button class="btn-danger mr-auto" onclick={remove} disabled={saving}>Delete</button>
				<button class="btn-primary" onclick={save} disabled={saving}>Save</button>
			</div>
		</div>
	{/if}
</BottomSheet>
