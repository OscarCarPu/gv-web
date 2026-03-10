<script lang="ts">
	import type { TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		task: TaskByDueDateResponse;
		onstart?: () => void;
	}

	let { task, onstart }: Props = $props();

	const isStarted = $derived(task.started_at !== null);

	const formattedTime = $derived(() => {
		const totalMinutes = Math.floor(task.time_spent / 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	});

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
	}

	const hasOwnDue = $derived(task.due_at !== null);
	const hasProjectDue = $derived(!hasOwnDue && task.project_due_at !== null);
</script>

<div class="task-item">
	<div class="task-info">
		<span class="task-name">{task.name}</span>
		{#if task.project_name}
			<span class="task-project">
				{task.project_name}
				{#if hasProjectDue}
					<span class="task-project-due"><i class="fa-regular fa-calendar"></i> {formatDate(task.project_due_at!)}</span>
				{/if}
			</span>
		{/if}
		{#if task.description}
			<span class="task-description">{task.description}</span>
		{/if}
		<div class="task-meta">
			<span class="task-status" class:started={isStarted}>
				{isStarted ? 'En progreso' : 'Pendiente'}
			</span>
			{#if hasOwnDue}
				<span class="task-due"><i class="fa-regular fa-calendar"></i> {formatDate(task.due_at!)}</span>
			{/if}
			<span class="task-time"><i class="fa-regular fa-clock"></i> {formattedTime()}</span>
		</div>
	</div>
	<button class="btn-primary" onclick={onstart}>Iniciar</button>
</div>
