<script lang="ts">
	import type { TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';
	import type { TimerTask } from '$lib/domains/tasks/taskTimer.svelte';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import DepBadges from './DepBadges.svelte';
	import { linkify } from '$shared/utils/linkify';
	import { formatDateShort } from '$shared/utils/datetime';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		task: TaskByDueDateResponse;
		onstart?: (task: TimerTask) => void;
		onassign?: (task: TimerTask) => void;
		onstopandstart?: (task: TimerTask) => void;
		ontoggle?: (taskId: number, action: 'start' | 'finish') => void;
		ondetail?: (taskId: number) => void;
		isTimerRunning?: boolean;
		isToday?: boolean;
		isOverdue?: boolean;
	}

	let {
		task,
		onstart,
		onassign,
		onstopandstart,
		ontoggle,
		ondetail,
		isTimerRunning = false,
		isToday = false,
		isOverdue = false,
	}: Props = $props();

	const toTimerTask = (): TimerTask => ({
		id: task.id,
		name: task.name,
		projectName: task.project_name,
		description: task.description,
	});

	const isStarted = $derived(task.started_at !== null);
	const statusLabel = $derived(getStatusLabel(task.started_at, task.task_type, task.recurrence));

	const formattedTime = $derived(() => {
		const totalMinutes = Math.floor(task.time_spent / 60);
		const h = Math.floor(totalMinutes / 60);
		const m = totalMinutes % 60;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	});

	const hasOwnDue = $derived(task.due_at !== null);
	const hasProjectDue = $derived(!hasOwnDue && task.project_due_at !== null);
</script>

<div class="task-item" class:today={isToday} class:overdue={isOverdue} class:urgent={task.urgent}>
	<div class="task-info">
		<div class="task-name-row">
			<button class="task-name-btn" onclick={() => ondetail?.(task.id)}>{task.name}</button>
			{#if task.blocked}
				<Icon name="ban" class="blocked-icon" title="Blocked" />
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
						><Icon name="calendar" /> {formatDateShort(task.project_due_at!)}</span
					>
				{/if}
			</span>
		{/if}
		{#if task.description}
			<span class="task-description">{@html linkify(task.description)}</span>
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
				<span class="task-due"><Icon name="calendar" /> {formatDateShort(task.due_at!)}</span>
			{/if}
			<span class="task-time"><Icon name="clock" /> {formattedTime()}</span>
		</div>
	</div>
	<div class="task-actions">
		{#if isStarted}
			<button
				class="btn-primary"
				onclick={() => ontoggle?.(task.id, 'finish')}
				disabled={task.blocked}>{task.task_type === 'recurring' ? 'Renew' : 'Done'}</button
			>
		{:else}
			<button
				class="btn-primary btn-start"
				onclick={() => ontoggle?.(task.id, 'start')}
				disabled={task.blocked}>Start</button
			>
		{/if}
		{#if isTimerRunning}
			<div class="btn-split">
				<button
					class="btn-primary"
					onclick={() => onassign?.(toTimerTask())}
					disabled={task.blocked}
				>
					<Icon name="arrow-right" />Assign
				</button>
				<button
					class="btn-success"
					onclick={() => onstopandstart?.(toTimerTask())}
					disabled={task.blocked}
				>
					<Icon name="play" />{task.task_type === 'recurring' ? 'Renew Start' : 'Stop Start'}
				</button>
			</div>
		{:else}
			<button class="btn-primary" onclick={() => onstart?.(toTimerTask())} disabled={task.blocked}>
				<Icon name="play" />Start
			</button>
		{/if}
	</div>
</div>
