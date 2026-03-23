<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TimePicker from '$lib/shared/components/TimePicker.svelte';
	import TaskItem from '$lib/domains/tasks/components/TaskItem.svelte';
	import TreeNode from '$lib/domains/tasks/components/TreeNode.svelte';
	import TaskBottomSheet from '$lib/domains/tasks/components/TaskBottomSheet.svelte';
	import CreateBottomSheet from '$lib/domains/tasks/components/CreateBottomSheet.svelte';
	import FloatingReminder from '$lib/shared/components/FloatingReminder.svelte';
	import { createTaskTimer } from '$lib/domains/tasks/taskTimer.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import StartedAtEditor from '$lib/domains/tasks/components/StartedAtEditor.svelte';
	import TimeHistoryModal from '$lib/domains/tasks/components/TimeHistoryModal.svelte';
	import type { ActiveTreeNode, TimeEntrySummaryResponse } from '$lib/domains/tasks/types/Task.types';

	let { data } = $props();

	const timer = createTaskTimer();

	let summaryOverride = $state<TimeEntrySummaryResponse | null>(null);
	let commentExpanded = $state(false);
	let showTimeHistory = $state(false);
	let summary = $derived(summaryOverride ?? data.timeEntrySummary);

	let weekTargetTooltip = $derived.by(() => {
		const remaining = 288000 - summary.week;
		if (remaining <= 0) return 'Meta alcanzada ✓';

		const now = new Date();
		const jsDay = now.getDay(); // 0=Sun, 1=Mon...6=Sat
		const day = jsDay === 0 ? 7 : jsDay; // 1=Mon...7=Sun
		const wakingHoursPerDay = 17; // 7am–midnight
		const currentHour = now.getHours() + now.getMinutes() / 60;
		const wakingHoursLeft = Math.max(0, 24 - currentHour);
		const fractionToday = Math.min(wakingHoursLeft, wakingHoursPerDay) / wakingHoursPerDay;
		const remainingFullDays = 7 - day; // days after today through Sunday
		const totalDays = fractionToday + remainingFullDays;

		if (totalDays <= 0) return 'Meta alcanzada ✓';

		if (remainingFullDays === 0) {
			return `${formatTime(Math.round(remaining))} hoy`;
		}

		const perDay = remaining / totalDays;
		const today = perDay * fractionToday;
		return `${formatTime(Math.round(perDay))}/día · ${formatTime(Math.round(today))} hoy`;
	});

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	async function handleStop() {
		await timer.stopTimer();
		commentExpanded = false;
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleCancel() {
		await timer.cancelTimer();
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleStartedAtChange(newDate: Date) {
		await timer.updateStartedAt(newDate);
	}

	let selectedTaskId = $state<number | null>(null);
	let showCreate = $state(false);
	let createMode = $state<'task' | 'project'>('task');

	function openTaskDetail(id: number) {
		selectedTaskId = id;
	}

	function openDetail(id: number, type: 'project' | 'task') {
		if (type === 'project') goto(`/tasks/projects/${id}`);
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
				timer.restore(entry.id, entry.task_id, entry.started_at, dueDateTask.name, dueDateTask.project_name, entry.comment);
			} else {
				const treeTask = findTaskInTree(data.activeTree, entry.task_id);
				if (treeTask) {
					timer.restore(entry.id, entry.task_id, entry.started_at, treeTask.name, treeTask.projectName, entry.comment);
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
	const dailyReminders: Record<number, string> = {
		1: 'Limpiar cocina',
		2: 'Limpiar baño/cuartucho',
		3: 'Limpiar salón',
		4: 'Limpiar habitación',
		5: 'Limpiar entrada e invitados',
		6: 'Limpiar gatos y {ventanas, sofá, nevera, ...}',
		0: 'Limpiar coche'
	};
	const todayReminder = dailyReminders[new Date().getDay()];

	let timeEntries = $state([
		{ id: 1, start: '10:00', end: '11:00' }
	]);

	async function submitTimeEntry() {
		if (!timer.activeTimeEntryId) return;
		const entry = timeEntries[0];
		if (!entry.start || !entry.end) return;
		const today = new Date();
		const [startH, startM] = entry.start.split(':').map(Number);
		const [endH, endM] = entry.end.split(':').map(Number);
		const startedAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startH, startM, 0);
		const finishedAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endH, endM, 0);
		await tasksApi.updateTimeEntry(timer.activeTimeEntryId, {
			started_at: startedAt.toISOString(),
			finished_at: finishedAt.toISOString(),
			comment: timer.comment || null
		});
		timer.reset();
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}
</script>

<svelte:head>
	<title>Tareas</title>
</svelte:head>

<div class="container">
	<FloatingReminder icon="fa-solid fa-broom" text={todayReminder} />
	<h1>Tareas</h1>

	<div class="task-timer-panel">
		<div class="task-header">
			<button class="comment-toggle" class:has-comment={timer.comment.length > 0} onclick={() => { commentExpanded = !commentExpanded }} title="Comentario">
				<i class="fa-solid fa-comment"></i>
			</button>
			<button class="task-selector" class:active={timer.selectedTaskDisplay !== null} onclick={() => { if (timer.selectedTaskId) openTaskDetail(timer.selectedTaskId); }} disabled={!timer.selectedTaskId}>
				{timer.selectedTaskDisplay ?? 'Seleccionar Tarea'}
			</button>
			<button class="btn-cancel" onclick={handleCancel} disabled={!timer.activeTimeEntryId} title="Cancelar entrada"><i class="fa-solid fa-xmark"></i></button>
		</div>
		{#if commentExpanded || timer.comment.length > 0}
			<input
				class="comment-input"
				type="text"
				placeholder="Comentario..."
				value={timer.comment}
				oninput={(e) => timer.setComment(e.currentTarget.value)}
			/>
		{/if}

		<div class="timer-row">
			<div class="time-entries">
				{#each timeEntries as entry (entry.id)}
					<TimePicker value={entry.start} onchange={(v) => entry.start = v} />
					<span class="time-separator">-</span>
					<TimePicker value={entry.end} onchange={(v) => entry.end = v} />
				{/each}
				<button class="btn-primary" onclick={submitTimeEntry} disabled={!timer.activeTimeEntryId}><i class="fa-solid fa-plus"></i> Agregar</button>
			</div>

			<div class="timer-controls">
				<span
					id="timer-display-trigger"
					class="timer-display"
					class:clickable={timer.isRunning}
				>
					{timer.formattedTime}
				</span>
				{#if timer.isRunning && timer.startedAtDate}
					<StartedAtEditor
						startedAt={timer.startedAtDate}
						onchange={handleStartedAtChange}
					/>
				{/if}
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
			<div class="summary-item" class:danger={summary.today < 36000} class:warning={summary.today >= 36000 && summary.today <= 39600} class:completed={summary.today > 39600}>
				<span class="summary-label">Hoy</span>
				<div class="summary-bar-track">
					<div class="summary-bar-fill" style="width: {Math.min(summary.today / 43200 * 100, 100)}%"></div>
				</div>
				<span class="summary-value">{formatTime(summary.today)} / 12h</span>
			</div>
			<div class="summary-item" class:completed={summary.week >= 288000}>
				<span class="summary-label">Semana</span>
				<div class="summary-bar-track">
					<div class="summary-bar-fill" style="width: {Math.min(summary.week / 288000 * 100, 100)}%"></div>
				</div>
				<span class="summary-value">{formatTime(summary.week)} / 80h</span>
			</div>
			<div class="summary-actions">
				<span class="summary-pace">{weekTargetTooltip}</span>
				<button class="btn-icon" onclick={() => showTimeHistory = true} aria-label="Ver historial">
					<i class="fa-solid fa-chart-line"></i>
				</button>
			</div>
		</div>
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<div class="section-header">
				<h2>Próximas a vencer</h2>
				<button class="btn-primary btn-sm" onclick={() => { createMode = 'task'; showCreate = true; }}>
					<i class="fa-solid fa-plus"></i> Tarea
				</button>
			</div>
			<div class="task-list">
				{#each data.tasksByDueDate as task (task.id)}
					<TaskItem {task} onstart={() => timer.handleTaskStart(task.id, task.name, task.project_name)} ontoggle={handleTaskToggle} ondetail={openTaskDetail} isTimerRunning={timer.isRunning} />
				{/each}
			</div>
		</div>

		<div class="tasks-section">
			<div class="section-header">
				<h2>Proyectos activos</h2>
				<button class="btn-primary btn-sm" onclick={() => { createMode = 'project'; showCreate = true; }}>
					<i class="fa-solid fa-plus"></i> Proyecto
				</button>
			</div>
			<div class="task-list">
				<TreeNode nodes={data.activeTree} onstart={(id, name, proj) => timer.handleTaskStart(id, name, proj)} ontoggle={handleTreeToggle} ondetail={openDetail} isTimerRunning={timer.isRunning} />
			</div>
		</div>
	</div>
</div>

<TaskBottomSheet taskId={selectedTaskId} onclose={() => selectedTaskId = null} />
<CreateBottomSheet open={showCreate} onclose={() => showCreate = false} mode={createMode} />
<TimeHistoryModal open={showTimeHistory} onclose={() => showTimeHistory = false} />
