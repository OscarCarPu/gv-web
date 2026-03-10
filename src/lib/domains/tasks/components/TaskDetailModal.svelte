<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/shared/components/Modal.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
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
	let startedAt = $state('');
	let finishedAt = $state('');
	let newTodoName = $state('');

	function toLocalDatetime(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function toISOString(local: string): string | null {
		if (!local) return null;
		return new Date(local).toISOString();
	}

	$effect(() => {
		if (taskId != null) {
			tasksApi.getTask(taskId).then((t) => {
				task = t;
				todos = [...t.todos];
				name = t.name;
				description = t.description ?? '';
				dueAt = toLocalDatetime(t.due_at);
	
				startedAt = toLocalDatetime(t.started_at);
				finishedAt = toLocalDatetime(t.finished_at);
			});
		} else {
			task = null;
		}
	});

	async function save() {
		if (taskId == null) return;
		await tasksApi.updateTask(taskId, {
			name,
			description: description || null,
			due_at: toISOString(dueAt),
			started_at: toISOString(startedAt),
			finished_at: toISOString(finishedAt)
		});
		await invalidateAll();
		onclose();
	}

	async function remove() {
		if (taskId == null) return;
		await tasksApi.deleteTask(taskId);
		await invalidateAll();
		onclose();
	}

	async function toggleTodo(todo: TodoResponse) {
		const updated = await tasksApi.updateTodo(todo.id, { is_done: !todo.is_done });
		todos = todos.map((t) => (t.id === updated.id ? updated : t));
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
</script>

<Modal open={taskId != null && task != null} {onclose}>
	{#if task}
		<h2 class="modal-title">Detalle de tarea</h2>
		<div class="detail-form">
			<div class="detail-field">
				<label for="task-name">Nombre</label>
				<input id="task-name" type="text" bind:value={name} />
			</div>
			<div class="detail-field">
				<label for="task-desc">Descripción</label>
				<textarea id="task-desc" bind:value={description} rows="3"></textarea>
			</div>
			<div class="detail-field">
				<label for="task-due">Fecha límite</label>
				<input id="task-due" type="datetime-local" bind:value={dueAt} />
			</div>
			<div class="detail-field">
				<label for="task-started">Inicio</label>
				<input id="task-started" type="datetime-local" bind:value={startedAt} />
			</div>
			<div class="detail-field">
				<label for="task-finished">Fin</label>
				<input id="task-finished" type="datetime-local" bind:value={finishedAt} />
			</div>

			<div class="detail-field">
				<label>Todos</label>
				<div class="todo-list">
					{#each todos as todo (todo.id)}
						<div class="todo-item">
							<input type="checkbox" checked={todo.is_done} onchange={() => toggleTodo(todo)} />
							<span class:line-through={todo.is_done}>{todo.name}</span>
							<button class="btn-danger btn-sm ml-auto" onclick={() => deleteTodo(todo.id)}>
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
</Modal>
