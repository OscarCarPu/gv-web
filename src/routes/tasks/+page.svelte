<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import TimePicker from '$lib/shared/components/TimePicker.svelte';
	import TaskItem from '$lib/domains/tasks/components/TaskItem.svelte';
	import TreeNode from '$lib/domains/tasks/components/TreeNode.svelte';
	import TaskDetailModal from '$lib/domains/tasks/components/TaskDetailModal.svelte';
	import ProjectDetailModal from '$lib/domains/tasks/components/ProjectDetailModal.svelte';
	import { createTaskTimer } from '$lib/domains/tasks/taskTimer.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { ActiveTreeNode, TimeEntrySummaryResponse } from '$lib/domains/tasks/types/Task.types';

	let { data } = $props();

	const timer = createTaskTimer();

	let summaryOverride = $state<TimeEntrySummaryResponse | null>(null);
	let summary = $derived(summaryOverride ?? data.timeEntrySummary);

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	async function handleStop() {
		await timer.stopTimer();
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	let selectedTaskId = $state<number | null>(null);
	let selectedProjectId = $state<number | null>(null);

	function openTaskDetail(id: number) {
		selectedTaskId = id;
	}

	function openDetail(id: number, type: 'project' | 'task') {
		if (type === 'project') selectedProjectId = id;
		else selectedTaskId = id;
	}

	function findTaskInTree(nodes: ActiveTreeNode[], taskId: number, parentProjectName?: string): { name: string; projectName?: string } | null {
		for (const node of nodes) {
			if (node.type === 'task' && node.id === taskId) {
				return { name: node.name, projectName: parentProjectName };
			}
			if (node.children) {
				const projectName = node.type === 'project' ? node.name : parentProjectName;
				const found = findTaskInTree(node.children, taskId, projectName);
				if (found) return found;
			}
		}
		return null;
	}

	let lastHandledEntryId: number | null = null;

	$effect(() => {
		if (data.activeTimeEntry && !timer.isRunning) {
			if (data.activeTimeEntry.id === lastHandledEntryId) return;
			lastHandledEntryId = data.activeTimeEntry.id;
			const entry = data.activeTimeEntry;
			const dueDateTask = data.tasksByDueDate.find((t) => t.id === entry.task_id);
			if (dueDateTask) {
				timer.restore(entry.id, entry.task_id, entry.started_at, dueDateTask.name, dueDateTask.project_name);
			} else {
				const treeTask = findTaskInTree(data.activeTree, entry.task_id);
				if (treeTask) {
					timer.restore(entry.id, entry.task_id, entry.started_at, treeTask.name, treeTask.projectName);
				}
			}
		}
	});

	async function handleTaskToggle(taskId: number, action: 'start' | 'finish') {
		const now = new Date().toISOString();
		if (action === 'start') {
			await tasksApi.updateTask(taskId, { started_at: now });
		} else {
			await tasksApi.updateTask(taskId, { finished_at: now });
		}
		await invalidateAll();
	}

	async function handleTreeToggle(id: number, type: 'project' | 'task', action: 'start' | 'finish') {
		const now = new Date().toISOString();
		const payload = action === 'start' ? { started_at: now } : { finished_at: now };
		if (type === 'project') {
			await tasksApi.updateProject(id, payload);
		} else {
			await tasksApi.updateTask(id, payload);
		}
		await invalidateAll();
	}

	// Placeholder time entries
	let timeEntries = $state([
		{ id: 1, start: '00:00', end: '00:30' }
	]);

	function addTimeEntry() {
		timeEntries = [...timeEntries, { id: Date.now(), start: '', end: '' }];
	}
</script>

<svelte:head>
	<title>Tareas</title>
</svelte:head>

<div class="container">
	<h1>Tareas</h1>

	<div class="task-timer-panel">
		<button class="task-selector" class:active={timer.selectedTaskDisplay !== null} onclick={() => { if (timer.selectedTaskId) openTaskDetail(timer.selectedTaskId); }} disabled={!timer.selectedTaskId}>
			{timer.selectedTaskDisplay ?? 'Seleccionar Tarea'}
		</button>

		<div class="timer-row">
			<div class="time-entries">
				{#each timeEntries as entry (entry.id)}
					<TimePicker value={entry.start} onchange={(v) => entry.start = v} />
					<span class="time-separator">-</span>
					<TimePicker value={entry.end} onchange={(v) => entry.end = v} />
				{/each}
				<button class="btn-primary" onclick={addTimeEntry}><i class="fa-solid fa-plus"></i> Agregar</button>
			</div>

			<div class="timer-controls">
				<span class="timer-display">{timer.formattedTime}</span>
				{#if timer.isRunning}
					<button class="btn-primary running" onclick={handleStop}>
						<i class="fa-solid fa-stop"></i>
						Stop
					</button>
				{:else}
					<button class="btn-primary" onclick={timer.startTimer}>
						<i class="fa-solid fa-play"></i>
						Iniciar
					</button>
				{/if}
			</div>
		</div>

		<div class="time-summary">
			<div class="summary-item" class:completed={summary.today >= 43200}>
				<span class="summary-label">Hoy</span>
				<div class="summary-bar-track">
					<div class="summary-bar-fill" style="width: {Math.min(summary.today / 43200 * 100, 100)}%"></div>
				</div>
				<span class="summary-value">{formatTime(summary.today)} / 12h</span>
			</div>
			<div class="summary-item" class:completed={summary.week >= 342000}>
				<span class="summary-label">Semana</span>
				<div class="summary-bar-track">
					<div class="summary-bar-fill" style="width: {Math.min(summary.week / 342000 * 100, 100)}%"></div>
				</div>
				<span class="summary-value">{formatTime(summary.week)} / 95h</span>
			</div>
		</div>
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<h2>Próximas a vencer</h2>
			<div class="task-list">
				{#each data.tasksByDueDate as task (task.id)}
					<TaskItem {task} onstart={() => timer.handleTaskStart(task.id, task.name, task.project_name)} ontoggle={handleTaskToggle} ondetail={openTaskDetail} isTimerRunning={timer.isRunning} />
				{/each}
			</div>
		</div>

		<div class="tasks-section">
			<h2>Proyectos activos</h2>
			<div class="task-list">
				<TreeNode nodes={data.activeTree} onstart={(id, name, proj) => timer.handleTaskStart(id, name, proj)} ontoggle={handleTreeToggle} ondetail={openDetail} isTimerRunning={timer.isRunning} />
			</div>
		</div>
	</div>
</div>

<TaskDetailModal taskId={selectedTaskId} onclose={() => selectedTaskId = null} />
<ProjectDetailModal projectId={selectedProjectId} onclose={() => selectedProjectId = null} />
