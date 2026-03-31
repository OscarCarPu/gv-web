<script lang="ts">
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TaskDepRef, TaskListItem } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		selected: TaskDepRef[];
		onchange: (selected: TaskDepRef[]) => void;
		excludeId: number;
		label: string;
	}

	let { selected, onchange, excludeId, label }: Props = $props();

	let allTasks = $state<TaskListItem[]>([]);

	const selectedIds = $derived(new Set(selected.map((d) => d.id)));

	const available = $derived(
		allTasks.filter((t) => t.id !== excludeId && !selectedIds.has(t.id))
	);

	$effect(() => {
		tasksApi.listTasksFast().then((tasks) => (allTasks = tasks));
	});

	function add(e: Event) {
		const select = e.target as HTMLSelectElement;
		const id = Number(select.value);
		if (!id) return;
		const task = allTasks.find((t) => t.id === id);
		if (!task) return;
		const ref: TaskDepRef = { id: task.id, name: task.name, due_at: null };
		onchange([...selected, ref]);
		select.value = '';
	}

	function remove(id: number) {
		onchange(selected.filter((d) => d.id !== id));
	}
</script>

<div class="detail-field">
	<span class="label text-sm text-text-muted font-medium">{label}</span>
	{#if selected.length > 0}
		<div class="dep-selected-pills">
			{#each selected as dep (dep.id)}
				<span class="dep-pill">
					{dep.name}
					<button class="dep-pill-remove" onclick={() => remove(dep.id)} aria-label="Quitar {dep.name}">
						<i class="fa-solid fa-xmark"></i>
					</button>
				</span>
			{/each}
		</div>
	{/if}
	<select onchange={add}>
		<option value="">Agregar tarea...</option>
		{#each available as task (task.id)}
			<option value={task.id}>{task.name}</option>
		{/each}
	</select>
</div>
