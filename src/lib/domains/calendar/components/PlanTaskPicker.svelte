<script lang="ts">
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { groupTasksByProject } from '$lib/domains/tasks/utils/taskGroups';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import type { PlanTaskMode } from '$lib/domains/calendar/utils/eventPlan';

	interface Props {
		mode: PlanTaskMode;
		taskId: number | null;
		newTaskName: string;
		/** Prefix for the input ids, so two pickers on one page never collide. */
		idPrefix?: string;
	}

	let {
		mode = $bindable(),
		taskId = $bindable(),
		newTaskName = $bindable(),
		idPrefix = 'plan',
	}: Props = $props();

	let tasks = $state<TaskListItem[]>([]);
	const groups = $derived(groupTasksByProject(tasks));

	$effect(() => {
		tasksApi.listTasksFast().then((t) => (tasks = t));
	});
</script>

<div class="detail-field">
	<span class="cal-label">Task</span>
	<div class="create-mode-toggle">
		<button type="button" class:active={mode === 'none'} onclick={() => (mode = 'none')}
			>No task</button
		>
		<button type="button" class:active={mode === 'existing'} onclick={() => (mode = 'existing')}
			>Existing</button
		>
		<button type="button" class:active={mode === 'new'} onclick={() => (mode = 'new')}>New</button>
	</div>
</div>

{#if mode === 'existing'}
	<div class="detail-field">
		<label for="{idPrefix}-task-select">Choose a task</label>
		<select id="{idPrefix}-task-select" bind:value={taskId}>
			<option value={null}>Select…</option>
			{#each groups as group (group.projectId)}
				<optgroup label={group.label}>
					{#each group.tasks as task (task.id)}
						<option value={task.id}>{task.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
{:else if mode === 'new'}
	<div class="detail-field">
		<label for="{idPrefix}-task-new">New task name</label>
		<input id="{idPrefix}-task-new" type="text" bind:value={newTaskName} />
	</div>
{/if}
