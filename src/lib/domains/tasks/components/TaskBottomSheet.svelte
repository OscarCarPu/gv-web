<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { toLocalDatetime, toISOString, formatTime, formatDateFull } from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import type { TaskFullResponse, TodoResponse, TaskDepRef } from '$lib/domains/tasks/types/Task.types';
	import DepSelector from './DepSelector.svelte';

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
	let saving = $state(false);
	let nameError = $state(false);
	let dependsOn = $state<TaskDepRef[]>([]);
	let taskDepends = $state<TaskDepRef[]>([]);
	let initialTaskDepends = $state<TaskDepRef[]>([]);

	async function loadTask() {
		if (taskId == null) return;
		const t = await tasksApi.getTask(taskId);
		task = t;
		todos = sortTodos([...t.todos]);
		name = t.name;
		description = t.description ?? '';
		dueAt = toLocalDatetime(t.due_at);
		dependsOn = [...t.depends_on];
		taskDepends = [...t.task_depends];
		initialTaskDepends = [...t.task_depends];
		if (t.project_id) {
			tasksApi.getProject(t.project_id).then((p) => { projectName = p.name; });
		} else {
			projectName = null;
		}
	}

	$effect(() => {
		if (taskId != null) {
			projectName = null;
			nameError = false;
			loadTask();
		} else {
			task = null;
		}
	});

	async function setStarted() {
		if (taskId == null) return;
		try {
			await tasksApi.updateTask(taskId, { started_at: new Date().toISOString() });
			await loadTask();
			await invalidateAll();
		} catch {
			addToast('Error al iniciar tarea', 'error');
		}
	}

	async function setFinished() {
		if (taskId == null) return;
		try {
			await tasksApi.updateTask(taskId, { finished_at: new Date().toISOString() });
			await loadTask();
			await invalidateAll();
		} catch {
			addToast('Error al finalizar tarea', 'error');
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
			await tasksApi.updateTask(taskId, {
				name,
				description: description || null,
				due_at: toISOString(dueAt),
				depends_on: dependsOn.map((d) => d.id)
			});
			await syncReverseDepends();
			await invalidateAll();
			onclose();
		} catch {
			addToast('Error al guardar tarea', 'error');
		} finally {
			saving = false;
		}
	}

	async function syncReverseDepends() {
		if (taskId == null) return;
		const initialIds = new Set(initialTaskDepends.map((d) => d.id));
		const currentIds = new Set(taskDepends.map((d) => d.id));
		const added = taskDepends.filter((d) => !initialIds.has(d.id));
		const removed = initialTaskDepends.filter((d) => !currentIds.has(d.id));

		for (const dep of added) {
			const otherTask = await tasksApi.getTask(dep.id);
			const otherDeps = otherTask.depends_on.map((d) => d.id);
			if (!otherDeps.includes(taskId)) {
				await tasksApi.updateTask(dep.id, { depends_on: [...otherDeps, taskId] });
			}
		}
		for (const dep of removed) {
			const otherTask = await tasksApi.getTask(dep.id);
			const otherDeps = otherTask.depends_on.map((d) => d.id).filter((id) => id !== taskId);
			await tasksApi.updateTask(dep.id, { depends_on: otherDeps });
		}
	}

	async function remove() {
		if (taskId == null) return;
		saving = true;
		try {
			await tasksApi.deleteTask(taskId);
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error al eliminar tarea', 'error');
		} finally {
			saving = false;
		}
	}

	function sortTodos(list: TodoResponse[]): TodoResponse[] {
		return list.sort((a, b) => Number(a.is_done) - Number(b.is_done));
	}

	async function toggleTodo(todo: TodoResponse) {
		try {
			const updated = await tasksApi.updateTodo(todo.id, { is_done: !todo.is_done });
			todos = sortTodos(todos.map((t) => (t.id === updated.id ? updated : t)));
		} catch {
			addToast('Error al actualizar todo', 'error');
		}
	}

	async function deleteTodo(id: number) {
		try {
			await tasksApi.deleteTodo(id);
			todos = todos.filter((t) => t.id !== id);
		} catch {
			addToast('Error al eliminar todo', 'error');
		}
	}

	async function addTodo() {
		if (!newTodoName.trim() || taskId == null) return;
		try {
			const created = await tasksApi.createTodo({ task_id: taskId, name: newTodoName.trim() });
			todos = [...todos, created];
			newTodoName = '';
		} catch {
			addToast('Error al agregar todo', 'error');
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
					<i class="fa-solid fa-folder"></i>
					{projectName}
				</button>
			{/if}
			<h3 class="modal-title">Detalle de tarea</h3>
		</div>

		<div class="detail-form">
			<div class="detail-inline-row">
				<div class="detail-field flex-1">
					<label for="task-name">Nombre</label>
					<input id="task-name" type="text" bind:value={name} class:field-error={nameError} oninput={() => nameError = false} />
				</div>
				<div class="detail-field">
					<label for="dtp-task-due">Fecha límite</label>
					<DatetimePicker bind:value={dueAt} id="task-due" />
				</div>
			</div>
			<div class="detail-field">
				<label for="task-desc">Descripción</label>
				<textarea id="task-desc" bind:value={description} rows="2"></textarea>
			</div>

			<div class="detail-info-row">
				<div class="detail-info-item">
					<span class="detail-info-label">Inicio</span>
					{#if task.started_at}
						<span class="detail-info-value">{formatDateFull(task.started_at)}</span>
					{:else}
						<button class="btn-action-sm btn-start" onclick={setStarted}>Empezar</button>
					{/if}
				</div>
				<div class="detail-info-item">
					<span class="detail-info-label">Fin</span>
					{#if task.finished_at}
						<span class="detail-info-value">{formatDateFull(task.finished_at)}</span>
					{:else}
						<button class="btn-action-sm" onclick={setFinished}>Finalizar</button>
					{/if}
				</div>
				{#if task.time_spent > 0}
					<div class="detail-info-item">
						<span class="detail-info-label">Tiempo</span>
						<span class="detail-info-value">{formatTime(task.time_spent)}</span>
					</div>
				{/if}
			</div>

			<DepSelector
				selected={dependsOn}
				onchange={(deps) => dependsOn = deps}
				excludeId={taskId!}
				label="Depende de"
			/>

			<DepSelector
				selected={taskDepends}
				onchange={(deps) => taskDepends = deps}
				excludeId={taskId!}
				label="Dependientes"
			/>

			<div class="detail-field">
				<span class="label text-sm text-text-muted font-medium">Todos</span>
				<div class="todo-list">
					{#each todos as todo (todo.id)}
						<div class="todo-item">
							<input type="checkbox" checked={todo.is_done} onchange={() => toggleTodo(todo)} />
							<span class:line-through={todo.is_done}>{todo.name}</span>
							<button class="btn-danger btn-sm ml-auto" onclick={() => deleteTodo(todo.id)} aria-label="Delete todo">
								<i class="fa-solid fa-trash"></i>
							</button>
						</div>
					{/each}
				</div>
				<div class="todo-add">
					<input type="text" placeholder="Nuevo todo..." bind:value={newTodoName} onkeydown={(e) => e.key === 'Enter' && addTodo()} />
					<button class="btn-primary btn-sm" onclick={addTodo}>Agregar</button>
				</div>
			</div>

			<div class="detail-actions">
				<button class="btn-danger mr-auto" onclick={remove} disabled={saving}>Eliminar</button>
				<button class="btn-primary" onclick={save} disabled={saving}>Guardar</button>
			</div>
		</div>
	{/if}
</BottomSheet>
