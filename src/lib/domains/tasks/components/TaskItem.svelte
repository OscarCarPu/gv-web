<script lang="ts">
	import type { TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import DepBadges from './DepBadges.svelte';

	interface Props {
		task: TaskByDueDateResponse;
		onstart?: () => void;
		ontoggle?: (taskId: number, action: 'start' | 'finish') => void;
		ondetail?: (taskId: number) => void;
		isTimerRunning?: boolean;
		isToday?: boolean;
	}

	let {
		task,
		onstart,
		ontoggle,
		ondetail,
		isTimerRunning = false,
		isToday = false,
	}: Props = $props();

	const isStarted = $derived(task.started_at !== null);
	const statusLabel = $derived(getStatusLabel(task.started_at, task.task_type, task.recurrence));

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

<div class="task-item" class:today={isToday}>
	<div class="task-info">
		<div class="task-name-row">
			<button class="task-name-btn" onclick={() => ondetail?.(task.id)}>{task.name}</button>
			{#if task.blocked}
				<i class="fa-solid fa-ban blocked-icon" title="Bloqueada"></i>
			{/if}
		</div>
		{#if task.depends_on?.length}
			<DepBadges deps={task.depends_on} ondetail={(id) => ondetail?.(id)} />
		{/if}
		{#if task.project_name}
			<span class="task-project">
				{task.project_name}
				{#if hasProjectDue}
					<span class="task-project-due"
						><i class="fa-regular fa-calendar"></i> {formatDate(task.project_due_at!)}</span
					>
				{/if}
			</span>
		{/if}
		{#if task.description}
			<span class="task-description">{task.description}</span>
		{/if}
		<div class="task-meta">
			<span
				class="status-badge"
				class:started={isStarted && task.task_type === 'standard'}
				class:continuous={task.task_type === 'continuous' && isStarted}
				class:recurring={task.task_type === 'recurring' && isStarted}
			>
				{statusLabel}
			</span>
			<span class="priority-badge p-{task.priority}">P{task.priority}</span>
			{#if hasOwnDue}
				<span class="task-due"
					><i class="fa-regular fa-calendar"></i> {formatDate(task.due_at!)}</span
				>
			{/if}
			<span class="task-time"><i class="fa-regular fa-clock"></i> {formattedTime()}</span>
		</div>
	</div>
	<div class="task-actions">
		{#if isStarted}
			<button
				class="btn-primary"
				onclick={() => ontoggle?.(task.id, 'finish')}
				disabled={task.blocked}>{task.task_type === 'recurring' ? 'Renovar' : 'Acabar'}</button
			>
		{:else}
			<button
				class="btn-primary btn-start"
				onclick={() => ontoggle?.(task.id, 'start')}
				disabled={task.blocked}>Empezar</button
			>
		{/if}
		<button class="btn-primary" onclick={onstart} disabled={task.blocked}>
			<i class="fa-solid {isTimerRunning ? 'fa-arrow-right' : 'fa-play'}"></i>
			{isTimerRunning ? 'Asignar' : 'Iniciar'}
		</button>
	</div>
</div>
