<script lang="ts">
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TaskDepRef, TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		selected: TaskDepRef[];
		onchange: (selected: TaskDepRef[]) => void;
		excludeId: number;
		label: string;
		projectId?: number | null;
	}

	let { selected, onchange, excludeId, label, projectId = null }: Props = $props();

	let allTasks = $state<TaskListItem[]>([]);

	const selectedIds = $derived(new Set(selected.map((d) => d.id)));

	const available = $derived(allTasks.filter((t) => t.id !== excludeId && !selectedIds.has(t.id)));

	interface TaskGroup {
		label: string;
		projectId: number | null;
		tasks: TaskListItem[];
	}

	const grouped = $derived.by(() => {
		const groupMap = new Map<number | null, { label: string; tasks: TaskListItem[] }>();

		for (const t of available) {
			const key = t.project_id;
			if (!groupMap.has(key)) {
				groupMap.set(key, {
					label: t.project_name ?? 'No project',
					tasks: [],
				});
			}
			groupMap.get(key)!.tasks.push(t);
		}

		// Mover el grupo del proyecto actual al principio
		const groups: TaskGroup[] = [];
		const currentKey = projectId ?? null;
		const currentGroup = groupMap.get(currentKey);
		if (currentGroup) {
			groups.push({ label: currentGroup.label, projectId: currentKey, tasks: currentGroup.tasks });
			groupMap.delete(currentKey);
		}
		for (const [pid, g] of groupMap) {
			groups.push({ label: g.label, projectId: pid, tasks: g.tasks });
		}

		return groups;
	});

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
	<span class="label text-text-muted text-sm font-medium">{label}</span>
	{#if selected.length > 0}
		<div class="dep-selected-pills">
			{#each selected as dep (dep.id)}
				<span class="dep-pill">
					{dep.name}
					<button
						class="dep-pill-remove"
						onclick={() => remove(dep.id)}
						aria-label="Remove {dep.name}"
					>
						<Icon name="xmark" />
					</button>
				</span>
			{/each}
		</div>
	{/if}
	<select onchange={add}>
		<option value="">Add task...</option>
		{#each grouped as group}
			<optgroup label={group.label}>
				{#each group.tasks as task (task.id)}
					<option value={task.id}>{task.name}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</div>
