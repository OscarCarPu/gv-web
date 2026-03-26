<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { toLocalDatetime, toISOString, formatTime, formatDateFull } from '$lib/shared/utils/datetime';
	import type { TaskFullResponse, TodoResponse } from '$lib/domains/tasks/types/Task.types';

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

	async function loadTask() {
		if (taskId == null) return;
		const t = await tasksApi.getTask(taskId);
		task = t;
		todos = sortTodos([...t.todos]);
		name = t.name;
		description = t.description ?? '';
		dueAt = toLocalDatetime(t.due_at);
		if (t.project_id) {
			tasksApi.getProject(t.project_id).then((p) => { projectName = p.name; });
		} else {
			projectName = null;
		}
	}

	$effect(() => {
		if (taskId != null) {
			projectName = null;
			loadTask();
		} else {
			task = null;
		}
	});

	async function setStarted() {
		if (taskId == null) return;
		await tasksApi.updateTask(taskId, { started_at: new Date().toISOString() });
		await loadTask();
		await invalidateAll();
	}

	async function setFinished() {
		if (taskId == null) return;
		await tasksApi.updateTask(taskId, { finished_at: new Date().toISOString() });
		await loadTask();
		await invalidateAll();
	}

	async function save() {
		if (taskId == null) return;
		await tasksApi.updateTask(taskId, {
			name,
			description: description || null,
			due_at: toISOString(dueAt)
		});
		await invalidateAll();
		onclose();
	}

	async function remove() {
		if (taskId == null) return;
		await tasksApi.deleteTask(taskId);
		onclose();
		await invalidateAll();
	}

	function sortTodos(list: TodoResponse[]): TodoResponse[] {
		return list.sort((a, b) => Number(a.is_done) - Number(b.is_done));
	}

	async function toggleTodo(todo: TodoResponse) {
		const updated = await tasksApi.updateTodo(todo.id, { is_done: !todo.is_done });
		todos = sortTodos(todos.map((t) => (t.id === updated.id ? updated : t)));
	}

	async function deleteTodo(id: number) {
		await tasksApi.deleteTodo(id);
		todos = todos.filter((t) => t.id !== id);
	}

	async function addTodo() {
		if (!newTodoName.trim() || taskId == null) return;
		const created = await tasksApi.createTodo({ task_id: taskId, name: newTodoName.trim() });
		todos = [...todos, created];
		newTodoName = '';
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
				<div class="detail-field" style="flex:1">
					<label for="task-name">Nombre</label>
					<input id="task-name" type="text" bind:value={name} />
				</div>
				<div class="detail-field">
					<label for="task-due">Fecha límite</label>
					<input id="task-due" type="datetime-local" bind:value={dueAt} />
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
				<button class="btn-danger" onclick={remove}>Eliminar</button>
				<button class="btn-primary" onclick={save}>Guardar</button>
			</div>
		</div>
	{/if}
</BottomSheet>
