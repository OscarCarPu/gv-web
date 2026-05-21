<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import TimePicker from '$lib/shared/components/TimePicker.svelte';
	import TaskItem from '$lib/domains/tasks/components/TaskItem.svelte';
	import TreeNode from '$lib/domains/tasks/components/TreeNode.svelte';
	import TaskBottomSheet from '$lib/domains/tasks/components/TaskBottomSheet.svelte';
	import CreateBottomSheet from '$lib/domains/tasks/components/CreateBottomSheet.svelte';
	import { createTaskTimer } from '$lib/domains/tasks/taskTimer.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import StartedAtEditor from '$lib/domains/tasks/components/StartedAtEditor.svelte';
	import TimeHistoryModal from '$lib/domains/tasks/components/TimeHistoryModal.svelte';
	import AgendaRightSheet from '$lib/domains/tasks/components/AgendaRightSheet.svelte';
	import PlanSection from '$lib/domains/tasks/components/PlanSection.svelte';
	import type {
		ActiveTreeNode,
		TimeEntrySummaryResponse,
	} from '$lib/domains/tasks/types/Task.types';
	import {
		toLocalDateString,
		toISOString,
		formatDueDay,
		formatTime,
	} from '$lib/shared/utils/datetime';
	import { buildPaceTooltip } from '$lib/domains/tasks/utils/paceLabel';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { linkify } from '$lib/shared/utils/linkify';

	let { data } = $props();

	const timer = createTaskTimer();

	let summaryOverride = $state<TimeEntrySummaryResponse | null>(null);
	let commentExpanded = $state(false);
	let showTimeHistory = $state(false);
	let showAgenda = $state(false);

	const FOLD_LIMIT = 15;
	const EXPAND_STEP = 10;
	let dueDateVisibleCount = $state(FOLD_LIMIT);
	let dueDatePriorityFilter = $state<number | null>(null);
	let dueDateProjectFilter = $state<number | null>(null);
	let activeTreePriorityFilter = $state<number | null>(null);
	let pendingTaskIds = $state(new SvelteSet<number>());
	let pendingProjectIds = $state(new SvelteSet<number>());

	function flattenProjectsFromTree(
		nodes: ActiveTreeNode[],
		depth = 0
	): { id: number; name: string; depth: number }[] {
		const result: { id: number; name: string; depth: number }[] = [];
		for (const node of nodes) {
			if (node.type === 'project') {
				result.push({ id: node.id, name: node.name, depth });
				if (node.children) result.push(...flattenProjectsFromTree(node.children, depth + 1));
			}
		}
		return result;
	}

	function collectProjectIds(nodes: ActiveTreeNode[], targetId: number): Set<number> {
		const ids = new Set<number>();
		function gather(node: ActiveTreeNode) {
			if (node.type === 'project') {
				ids.add(node.id);
				node.children?.forEach(gather);
			}
		}
		function find(ns: ActiveTreeNode[]): boolean {
			for (const node of ns) {
				if (node.type === 'project' && node.id === targetId) {
					gather(node);
					return true;
				}
				if (node.children && find(node.children)) return true;
			}
			return false;
		}
		find(nodes);
		return ids;
	}

	let dueDateProjectOptions = $derived(flattenProjectsFromTree(data.activeTree));
	let dueDateProjectIds = $derived(
		dueDateProjectFilter === null ? null : collectProjectIds(data.activeTree, dueDateProjectFilter)
	);

	let filteredByDueDate = $derived(
		(dueDatePriorityFilter === null
			? data.tasksByDueDate
			: data.tasksByDueDate.filter((t) => t.priority <= dueDatePriorityFilter!)
		)
			.filter((t) => !pendingTaskIds.has(t.id))
			.filter((t) => {
				if (dueDateProjectIds === null) return true;
				return t.project_id !== null && dueDateProjectIds.has(t.project_id);
			})
	);
	let visibleDueDateTasks = $derived(filteredByDueDate.slice(0, dueDateVisibleCount));
	let todayKey = $derived(toLocalDateString());
	let dueTodayCount = $derived.by(() => {
		const today = todayKey;
		let n = 0;
		for (const t of filteredByDueDate) {
			const d = t.due_at ?? t.project_due_at;
			if (d && d.slice(0, 10) <= today) n++;
		}
		return n;
	});
	let hasMoreDueDateTasks = $derived(dueDateVisibleCount < filteredByDueDate.length);
	let remainingDueDateTasks = $derived(filteredByDueDate.length - dueDateVisibleCount);

	$effect(() => {
		dueDatePriorityFilter;
		dueDateProjectFilter;
		dueDateVisibleCount = FOLD_LIMIT;
	});

	function filterTree(
		nodes: ActiveTreeNode[],
		min: number | null,
		pendingTasks: SvelteSet<number>,
		pendingProjects: SvelteSet<number>
	): ActiveTreeNode[] {
		const result: ActiveTreeNode[] = [];
		for (const node of nodes) {
			if (node.type === 'project') {
				if (pendingProjects.has(node.id)) continue;
				result.push({
					...node,
					children: node.children
						? filterTree(node.children, min, pendingTasks, pendingProjects)
						: undefined,
				});
			} else {
				if (pendingTasks.has(node.id)) continue;
				if (min !== null && (node.priority ?? 3) > min) continue;
				result.push(node);
			}
		}
		return result;
	}

	let filteredActiveTree = $derived(
		filterTree(data.activeTree, activeTreePriorityFilter, pendingTaskIds, pendingProjectIds)
	);

	function showMoreDueDateTasks() {
		dueDateVisibleCount = Math.min(dueDateVisibleCount + EXPAND_STEP, filteredByDueDate.length);
	}

	let summary = $derived(summaryOverride ?? data.timeEntrySummary);
	let dailyTarget = $derived(summary.daily_target_seconds);
	let dailyTargetLabel = $derived(formatTime(summary.daily_target_seconds));
	let weekTargetTooltip = $derived(buildPaceTooltip(summary));

	async function handleStop() {
		commentExpanded = false;
		addNotification('Tiempo registrado', 'success');
		await timer.stopTimer();
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleCancel() {
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		addNotification('Tiempo cancelado', 'success');
		await timer.cancelTimer();
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleStartedAtChange(newDate: Date) {
		await timer.updateStartedAt(newDate);
	}

	function scrollToSection(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function handleTaskStartWithNotification(
		taskId: number,
		taskName: string,
		projectName?: string | null,
		taskDescription?: string | null
	) {
		addNotification('Temporizador iniciado', 'success');
		await timer.handleTaskStart(taskId, taskName, projectName, taskDescription);
	}

	let selectedTaskId = $state<number | null>(null);
	let showCreate = $state(false);
	let createMode = $state<'task' | 'project'>('task');
	let createPrefillProjectId = $state<number | null>(null);

	function openTaskDetail(id: number) {
		selectedTaskId = id;
	}

	function handleAgendaTaskClick(taskId: number, projectId: number | null) {
		showAgenda = false;
		if (projectId) {
			goto(`/tasks/projects/${projectId}?task=${taskId}`);
		} else {
			selectedTaskId = taskId;
		}
	}

	function openDetail(id: number, type: 'project' | 'task') {
		if (type === 'project') goto(`/tasks/projects/${id}`);
		else selectedTaskId = id;
	}

	let lastHandledEntryId: number | null = null;

	$effect(() => {
		if (data.activeTimeEntry && !timer.isRunning) {
			if (data.activeTimeEntry.id === lastHandledEntryId) return;
			lastHandledEntryId = data.activeTimeEntry.id;
			const entry = data.activeTimeEntry;
			timer.restore(
				entry.id,
				entry.task_id,
				entry.started_at,
				entry.task_name,
				entry.project_name,
				entry.comment,
				entry.task_description
			);
		}
	});

	function buildRecurringDueAt(recurrence: number): string {
		const d = new Date();
		d.setDate(d.getDate() + recurrence);
		return toISOString(toLocalDateString(d) + 'T12:00')!;
	}

	function findTreeTask(nodes: ActiveTreeNode[], id: number): ActiveTreeNode | undefined {
		for (const node of nodes) {
			if (node.type === 'task' && node.id === id) return node;
			if (node.children) {
				const found = findTreeTask(node.children, id);
				if (found) return found;
			}
		}
	}

	async function handleTaskToggle(taskId: number, action: 'start' | 'finish') {
		const now = new Date().toISOString();
		const task = data.tasksByDueDate.find((t) => t.id === taskId);
		if (!task) return;

		if (action === 'start') {
			const prev = task.started_at;
			task.started_at = now;
			addNotification('Tarea iniciada', 'success');
			try {
				await tasksApi.updateTask(taskId, { started_at: now });
				await invalidateAll();
			} catch {
				task.started_at = prev;
				addToast('Error al iniciar tarea', 'error');
			}
			return;
		}

		if (task.task_type === 'recurring' && task.recurrence) {
			const prev = task.due_at;
			const newDueAt = buildRecurringDueAt(task.recurrence);
			task.due_at = newDueAt;
			addNotification('Tarea renovada', 'success');
			try {
				await tasksApi.updateTask(taskId, { due_at: newDueAt });
				await invalidateAll();
			} catch {
				task.due_at = prev;
				addToast('Error al renovar tarea', 'error');
			}
			return;
		}

		pendingTaskIds.add(taskId);
		addNotification('Tarea finalizada', 'success');
		try {
			await tasksApi.updateTask(taskId, { finished_at: now });
			await invalidateAll();
		} catch {
			pendingTaskIds.delete(taskId);
			addToast('Error al finalizar tarea', 'error');
		}
	}

	function findTreeProject(nodes: ActiveTreeNode[], id: number): ActiveTreeNode | undefined {
		for (const node of nodes) {
			if (node.type === 'project') {
				if (node.id === id) return node;
				if (node.children) {
					const found = findTreeProject(node.children, id);
					if (found) return found;
				}
			}
		}
	}

	async function handleTreeToggle(
		id: number,
		type: 'project' | 'task',
		action: 'start' | 'finish'
	) {
		const now = new Date().toISOString();

		if (type === 'project') {
			const project = findTreeProject(data.activeTree, id);
			if (action === 'start') {
				const prev = project?.started_at;
				if (project) project.started_at = now;
				addNotification('Proyecto iniciado', 'success');
				try {
					await tasksApi.updateProject(id, { started_at: now });
					await invalidateAll();
				} catch {
					if (project) project.started_at = prev ?? null;
					addToast('Error al iniciar proyecto', 'error');
				}
				return;
			}
			pendingProjectIds.add(id);
			addNotification('Proyecto finalizado', 'success');
			try {
				await tasksApi.updateProject(id, { finished_at: now });
				await invalidateAll();
			} catch {
				pendingProjectIds.delete(id);
				addToast('Error al finalizar proyecto', 'error');
			}
			return;
		}

		const task = findTreeTask(data.activeTree, id);
		if (action === 'start') {
			const prev = task?.started_at;
			if (task) task.started_at = now;
			addNotification('Tarea iniciada', 'success');
			try {
				await tasksApi.updateTask(id, { started_at: now });
				await invalidateAll();
			} catch {
				if (task) task.started_at = prev ?? null;
				addToast('Error al iniciar tarea', 'error');
			}
			return;
		}

		if (task?.task_type === 'recurring' && task.recurrence) {
			const prev = task.due_at;
			const newDueAt = buildRecurringDueAt(task.recurrence);
			task.due_at = newDueAt;
			addNotification('Tarea renovada', 'success');
			try {
				await tasksApi.updateTask(id, { due_at: newDueAt });
				await invalidateAll();
			} catch {
				task.due_at = prev;
				addToast('Error al renovar tarea', 'error');
			}
			return;
		}

		pendingTaskIds.add(id);
		addNotification('Tarea finalizada', 'success');
		try {
			await tasksApi.updateTask(id, { finished_at: now });
			await invalidateAll();
		} catch {
			pendingTaskIds.delete(id);
			addToast('Error al finalizar tarea', 'error');
		}
	}

	// Placeholder time entries

	let timeEntries = $state([{ id: 1, start: '10:00', end: '11:00' }]);

	async function submitTimeEntry() {
		if (!timer.activeTimeEntryId) return;
		const entry = timeEntries[0];
		if (!entry.start || !entry.end) return;
		const today = new Date();
		const [startH, startM] = entry.start.split(':').map(Number);
		const [endH, endM] = entry.end.split(':').map(Number);
		const startedAt = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
			startH,
			startM,
			0
		);
		const finishedAt = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
			endH,
			endM,
			0
		);
		const entryId = timer.activeTimeEntryId;
		const entryComment = timer.comment;
		timer.reset();
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		addNotification('Tiempo registrado', 'success');
		await tasksApi.updateTimeEntry(entryId, {
			started_at: startedAt.toISOString(),
			finished_at: finishedAt.toISOString(),
			comment: entryComment || null,
		});
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}
</script>

<svelte:head>
	<title>Tareas</title>
</svelte:head>

<div class="container">
	<h1>Tareas</h1>

	<div class="task-timer-row">
		<div class="task-timer-panel">
			<div class="task-header">
				<button
					class="comment-toggle"
					class:has-comment={timer.comment.length > 0}
					onclick={() => {
						commentExpanded = !commentExpanded;
					}}
					title="Comentario"
				>
					<Icon name="comment" />
				</button>
				<button
					class="task-selector"
					class:active={timer.selectedTaskDisplay !== null}
					onclick={() => {
						if (timer.selectedTaskId) openTaskDetail(timer.selectedTaskId);
					}}
					disabled={!timer.selectedTaskId}
				>
					{timer.selectedTaskDisplay ?? 'Seleccionar Tarea'}
				</button>
				<button
					class="btn-cancel"
					onclick={handleCancel}
					disabled={!timer.activeTimeEntryId}
					title="Cancelar entrada"><Icon name="xmark" /></button
				>
			</div>
			{#if timer.selectedTaskDescription}
				<div class="timer-task-description">
					{@html linkify(timer.selectedTaskDescription)}
				</div>
			{/if}
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
						<TimePicker value={entry.start} onchange={(v) => (entry.start = v)} />
						<span class="time-separator">-</span>
						<TimePicker value={entry.end} onchange={(v) => (entry.end = v)} />
					{/each}
					<button class="btn-primary" onclick={submitTimeEntry} disabled={!timer.activeTimeEntryId}
						><Icon name="plus" /> Agregar</button
					>
				</div>

				<div class="timer-controls">
					<span id="timer-display-trigger" class="timer-display" class:clickable={timer.isRunning}>
						{timer.formattedTime}
					</span>
					{#if timer.isRunning && timer.startedAtDate}
						<StartedAtEditor startedAt={timer.startedAtDate} onchange={handleStartedAtChange} />
					{/if}
					{#if timer.isRunning}
						<button class="btn-primary running" onclick={handleStop}>
							<Icon name="stop" />
							Stop
						</button>
					{:else}
						<button class="btn-primary" onclick={timer.startTimer}>
							<Icon name="play" />
							Iniciar
						</button>
					{/if}
				</div>
			</div>

			<div class="time-summary">
				<div
					class="summary-item"
					class:danger={summary.today < (dailyTarget * 5) / 6}
					class:warning={summary.today >= (dailyTarget * 5) / 6 &&
						summary.today <= (dailyTarget * 11) / 12}
					class:completed={summary.today > (dailyTarget * 11) / 12}
				>
					<span class="summary-label">Hoy</span>
					<div class="progress-track bg-bg">
						<div
							class="progress-fill"
							style="width: {Math.min((summary.today / dailyTarget) * 100, 100)}%"
						></div>
					</div>
					<span class="summary-value">{formatTime(summary.today)} / {dailyTargetLabel}</span>
				</div>
				<div class="summary-item" class:completed={summary.week >= summary.weekly_target_seconds}>
					<span class="summary-label">Semana</span>
					<div class="progress-track bg-bg">
						<div
							class="progress-fill"
							style="width: {Math.min((summary.week / summary.weekly_target_seconds) * 100, 100)}%"
						></div>
					</div>
					<span class="summary-value"
						>{formatTime(summary.week)} / {formatTime(summary.weekly_target_seconds)}</span
					>
				</div>
				<div class="summary-actions">
					<span class="summary-pace">{weekTargetTooltip}</span>
					<button
						class="btn-icon"
						onclick={() => (showTimeHistory = true)}
						aria-label="Ver historial"
					>
						<Icon name="chart-line" />
					</button>
					<button class="btn-icon" onclick={() => (showAgenda = true)} aria-label="Ver agenda">
						<Icon name="calendar-day" />
					</button>
				</div>
			</div>
		</div>

		<aside class="task-shortcuts-panel" aria-label="Accesos rápidos">
			<button
				class="task-shortcut"
				onclick={() => scrollToSection('plan-section')}
				title="Ir a Plan de hoy"
			>
				<Icon name="calendar-day" />
				<span>Plan</span>
			</button>
			<button
				class="task-shortcut"
				onclick={() => scrollToSection('active-projects-section')}
				title="Ir a Proyectos activos"
			>
				<Icon name="folder" />
				<span>Proyectos</span>
			</button>
		</aside>
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<div class="section-header">
				<h2>Próximas a vencer <span class="summary-pace">{dueTodayCount}</span></h2>

				<div class="priority-filter">
					{#each [1, 2, 3, 4] as p (p)}
						<button
							class:active={dueDatePriorityFilter === p}
							onclick={() => (dueDatePriorityFilter = p)}
							aria-label="Prioridad hasta {p}">≤{p}</button
						>
					{/each}
					<button
						class:active={dueDatePriorityFilter === null}
						onclick={() => (dueDatePriorityFilter = null)}>Todas</button
					>
					{#if dueDateProjectOptions.length > 0}
						<span class="filter-sep" aria-hidden="true">|</span>
						<select
							class="project-filter-select"
							class:active={dueDateProjectFilter !== null}
							bind:value={dueDateProjectFilter}
							aria-label="Filtrar por proyecto"
						>
							<option value={null}>Proyecto</option>
							{#each dueDateProjectOptions as opt (opt.id)}
								<option value={opt.id}>{' '.repeat(opt.depth * 2)}{opt.name}</option>
							{/each}
						</select>
					{/if}
				</div>
				<button
					class="btn-primary btn-sm"
					onclick={() => {
						createMode = 'task';
						createPrefillProjectId = null;
						showCreate = true;
					}}
				>
					<Icon name="plus" /> Tarea
				</button>
			</div>
			<div class="task-list">
				{#each visibleDueDateTasks as task, i (task.id)}
					{@const taskDate = task.due_at ?? task.project_due_at}
					{@const taskDateKey = taskDate ? taskDate.slice(0, 10) : 'no-date'}
					{@const prevTask = visibleDueDateTasks[i - 1]}
					{@const prevDate = prevTask ? (prevTask.due_at ?? prevTask.project_due_at) : null}
					{@const prevDateKey = prevDate ? prevDate.slice(0, 10) : 'no-date'}
					{@const isToday = taskDateKey === todayKey}
					{@const isOverdue = taskDateKey !== 'no-date' && taskDateKey < todayKey}
					{#if (i > 0 && taskDateKey !== prevDateKey) || (i === 0 && isToday)}
						<div class="agenda-day-divider" class:today={isToday}>
							<span class="agenda-day-line"></span>
							<span class="agenda-day-label">{formatDueDay(taskDate)}</span>
							<span class="agenda-day-line"></span>
						</div>
					{/if}
					<TaskItem
						{task}
						{isToday}
						{isOverdue}
						onstart={() =>
							handleTaskStartWithNotification(
								task.id,
								task.name,
								task.project_name,
								task.description
							)}
						ontoggle={handleTaskToggle}
						ondetail={openTaskDetail}
						isTimerRunning={timer.isRunning}
					/>
				{/each}
				{#if hasMoreDueDateTasks}
					<button class="show-more-btn" onclick={showMoreDueDateTasks}>
						<span class="show-more-line"></span>
						<span class="show-more-pill">
							<Icon name="chevron-down" />
							<span>{remainingDueDateTasks} más</span>
						</span>
						<span class="show-more-line"></span>
					</button>
				{/if}
			</div>
		</div>

		<PlanSection
			initial={data.plan}
			ontimerstart={handleTaskStartWithNotification}
			onafterchange={() => invalidateAll()}
			isTimerRunning={timer.isRunning}
			activeStartedAt={timer.isRunning ? (timer.startedAtDate?.toISOString() ?? null) : null}
		/>
	</div>

	<div class="tasks-content tasks-content-wide">
		<div id="active-projects-section" class="tasks-section">
			<div class="section-header">
				<div class="section-title">
					<h2>Proyectos activos</h2>
					<button class="btn-icon back-to-top" onclick={scrollToTop} title="Volver arriba">
						<Icon name="arrow-up" />
					</button>
				</div>
				<div class="priority-filter">
					<button
						class:active={activeTreePriorityFilter === null}
						onclick={() => (activeTreePriorityFilter = null)}>Todas</button
					>
					{#each [1, 2, 3, 4] as p (p)}
						<button
							class:active={activeTreePriorityFilter === p}
							onclick={() => (activeTreePriorityFilter = p)}
							aria-label="Prioridad hasta {p}">≤{p}</button
						>
					{/each}
				</div>
				<button
					class="btn-primary btn-sm"
					onclick={() => {
						createMode = 'project';
						createPrefillProjectId = null;
						showCreate = true;
					}}
				>
					<Icon name="plus" /> Proyecto
				</button>
			</div>
			<div class="task-list">
				<TreeNode
					nodes={filteredActiveTree}
					onstart={(id, name, proj) => handleTaskStartWithNotification(id, name, proj)}
					ontoggle={handleTreeToggle}
					ondetail={openDetail}
					oncreatetask={(projectId) => {
						createMode = 'task';
						createPrefillProjectId = projectId;
						showCreate = true;
					}}
					isTimerRunning={timer.isRunning}
				/>
			</div>
		</div>
	</div>
</div>

<TaskBottomSheet taskId={selectedTaskId} onclose={() => (selectedTaskId = null)} />
<CreateBottomSheet
	open={showCreate}
	onclose={() => {
		showCreate = false;
		createPrefillProjectId = null;
	}}
	mode={createMode}
	prefillProjectId={createPrefillProjectId}
/>
<TimeHistoryModal open={showTimeHistory} onclose={() => (showTimeHistory = false)} />
<AgendaRightSheet
	open={showAgenda}
	onclose={() => (showAgenda = false)}
	onopentask={handleAgendaTaskClick}
/>
