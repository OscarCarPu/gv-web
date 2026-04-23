<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
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
	import type {
		ActiveTreeNode,
		TimeEntrySummaryResponse,
	} from '$lib/domains/tasks/types/Task.types';
	import { toLocalDateString, toISOString } from '$lib/shared/utils/datetime';
	import { addNotification } from '$lib/shared/stores/notification.svelte';

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
	let activeTreePriorityFilter = $state<number | null>(null);

	let filteredByDueDate = $derived(
		dueDatePriorityFilter === null
			? data.tasksByDueDate
			: data.tasksByDueDate.filter((t) => t.priority <= dueDatePriorityFilter!)
	);
	let visibleDueDateTasks = $derived(filteredByDueDate.slice(0, dueDateVisibleCount));
	let hasMoreDueDateTasks = $derived(dueDateVisibleCount < filteredByDueDate.length);
	let remainingDueDateTasks = $derived(filteredByDueDate.length - dueDateVisibleCount);
	let todayKey = $derived(toLocalDateString());

	$effect(() => {
		dueDatePriorityFilter;
		dueDateVisibleCount = FOLD_LIMIT;
	});

	function filterTreeByPriority(nodes: ActiveTreeNode[], min: number | null): ActiveTreeNode[] {
		if (min === null) return nodes;
		const result: ActiveTreeNode[] = [];
		for (const node of nodes) {
			if (node.type === 'project') {
				result.push({
					...node,
					children: node.children ? filterTreeByPriority(node.children, min) : undefined,
				});
			} else if ((node.priority ?? 3) <= min) {
				result.push(node);
			}
		}
		return result;
	}

	let filteredActiveTree = $derived(
		filterTreeByPriority(data.activeTree, activeTreePriorityFilter)
	);

	function showMoreDueDateTasks() {
		dueDateVisibleCount = Math.min(dueDateVisibleCount + EXPAND_STEP, filteredByDueDate.length);
	}

	function formatDueDay(iso: string | null): string {
		if (!iso) return 'Sin fecha';
		const d = new Date(iso);
		const weekday = d.toLocaleDateString('es', { weekday: 'long' });
		return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d.getDate()}/${d.getMonth() + 1}`;
	}

	let summary = $derived(summaryOverride ?? data.timeEntrySummary);

	let isWeekend = $derived.by(() => {
		const day = new Date().getDay();
		return day === 0 || day === 6;
	});
	let dailyTarget = $derived(isWeekend ? 28800 : 43200);
	let dailyTargetLabel = $derived(isWeekend ? '8h' : '12h');

	let weekTargetTooltip = $derived.by(() => {
		const remaining = 288000 - summary.week;
		if (remaining <= 0) return 'Meta alcanzada ✓';

		const now = new Date();
		const jsDay = now.getDay(); // 0=Sun, 1=Mon...6=Sat
		const day = jsDay === 0 ? 7 : jsDay; // 1=Mon...7=Sun
		const currentHour = now.getHours() + now.getMinutes() / 60;
		const wakingHoursLeft = Math.max(0, 24 - currentHour);

		const isWeekendDay = (d: number) => d >= 6; // 6=Sat, 7=Sun
		const wakingHours = (d: number) => (isWeekendDay(d) ? 12 : 17);

		// Uniform calculation (all days equal, 17h)
		const uniformWaking = 17;
		const uniformFractionToday = Math.min(wakingHoursLeft, uniformWaking) / uniformWaking;
		const remainingFullDays = 7 - day;
		const uniformTotalDays = uniformFractionToday + remainingFullDays;

		// Weighted calculation (weekdays=17h, weekends=12h)
		const todayWaking = wakingHours(day);
		const weightedToday = Math.min(wakingHoursLeft, todayWaking);
		let weightedTotal = weightedToday;
		for (let d = day + 1; d <= 7; d++) {
			weightedTotal += wakingHours(d);
		}

		if (uniformTotalDays <= 0) return 'Meta alcanzada ✓';

		if (remainingFullDays === 0) {
			return `${formatTime(Math.round(remaining))} hoy`;
		}

		const uniformPerDay = remaining / uniformTotalDays;
		const uniformToday = uniformPerDay * uniformFractionToday;

		const weightedTodayShare = remaining * (weightedToday / weightedTotal);
		const weightedPerDayWeekday = remaining * (17 / weightedTotal);
		const weightedPerDayWeekend = remaining * (12 / weightedTotal);

		return `${formatTime(Math.round(uniformPerDay))}/día · ${formatTime(Math.round(uniformToday))} hoy | ${formatTime(Math.round(weightedPerDayWeekday))} L-V · ${formatTime(Math.round(weightedPerDayWeekend))} S-D · ${formatTime(Math.round(weightedTodayShare))} hoy`;
	});

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	async function handleStop() {
		await timer.stopTimer();
		addNotification('Tiempo registrado', 'success');
		commentExpanded = false;
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleCancel() {
		await timer.cancelTimer();
		addNotification('Tiempo cancelado', 'success');
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		summaryOverride = await tasksApi.getTimeEntrySummary();
	}

	async function handleStartedAtChange(newDate: Date) {
		await timer.updateStartedAt(newDate);
	}

	async function handleTaskStartWithNotification(taskId: number, taskName: string, projectName?: string | null) {
		await timer.handleTaskStart(taskId, taskName, projectName);
		addNotification('Temporizador iniciado', 'success');
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
				entry.comment
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
		if (action === 'start') {
			await tasksApi.updateTask(taskId, { started_at: now });
			addNotification('Tarea iniciada', 'success');
		} else {
			const task = data.tasksByDueDate.find((t) => t.id === taskId);
			if (task?.task_type === 'recurring' && task.recurrence) {
				await tasksApi.updateTask(taskId, { due_at: buildRecurringDueAt(task.recurrence) });
				addNotification('Tarea renovada', 'success');
			} else {
				await tasksApi.updateTask(taskId, { finished_at: now });
				addNotification('Tarea finalizada', 'success');
			}
		}
		await invalidateAll();
	}

	async function handleTreeToggle(
		id: number,
		type: 'project' | 'task',
		action: 'start' | 'finish'
	) {
		const now = new Date().toISOString();
		if (type === 'project') {
			const payload = action === 'start' ? { started_at: now } : { finished_at: now };
			await tasksApi.updateProject(id, payload);
			addNotification(action === 'start' ? 'Proyecto iniciado' : 'Proyecto finalizado', 'success');
		} else if (action === 'start') {
			await tasksApi.updateTask(id, { started_at: now });
			addNotification('Tarea iniciada', 'success');
		} else {
			const task = findTreeTask(data.activeTree, id);
			if (task?.task_type === 'recurring' && task.recurrence) {
				await tasksApi.updateTask(id, { due_at: buildRecurringDueAt(task.recurrence) });
				addNotification('Tarea renovada', 'success');
			} else {
				await tasksApi.updateTask(id, { finished_at: now });
				addNotification('Tarea finalizada', 'success');
			}
		}
		await invalidateAll();
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
		await tasksApi.updateTimeEntry(timer.activeTimeEntryId, {
			started_at: startedAt.toISOString(),
			finished_at: finishedAt.toISOString(),
			comment: timer.comment || null,
		});
		addNotification('Tiempo registrado', 'success');
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
	<h1>Tareas</h1>

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
				<i class="fa-solid fa-comment"></i>
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
				title="Cancelar entrada"><i class="fa-solid fa-xmark"></i></button
			>
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
					<TimePicker value={entry.start} onchange={(v) => (entry.start = v)} />
					<span class="time-separator">-</span>
					<TimePicker value={entry.end} onchange={(v) => (entry.end = v)} />
				{/each}
				<button class="btn-primary" onclick={submitTimeEntry} disabled={!timer.activeTimeEntryId}
					><i class="fa-solid fa-plus"></i> Agregar</button
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
			<div class="summary-item" class:completed={summary.week >= 288000}>
				<span class="summary-label">Semana</span>
				<div class="progress-track bg-bg">
					<div
						class="progress-fill"
						style="width: {Math.min((summary.week / 288000) * 100, 100)}%"
					></div>
				</div>
				<span class="summary-value">{formatTime(summary.week)} / 80h</span>
			</div>
			<div class="summary-actions">
				<span class="summary-pace">{weekTargetTooltip}</span>
				<button
					class="btn-icon"
					onclick={() => (showTimeHistory = true)}
					aria-label="Ver historial"
				>
					<i class="fa-solid fa-chart-line"></i>
				</button>
				<button class="btn-icon" onclick={() => (showAgenda = true)} aria-label="Ver agenda">
					<i class="fa-solid fa-calendar-day"></i>
				</button>
			</div>
		</div>
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<div class="section-header">
				<h2>Próximas a vencer</h2>
				<div class="priority-filter">
					<button
						class:active={dueDatePriorityFilter === null}
						onclick={() => (dueDatePriorityFilter = null)}>Todas</button
					>
					{#each [1, 2, 3, 4] as p (p)}
						<button
							class:active={dueDatePriorityFilter === p}
							onclick={() => (dueDatePriorityFilter = p)}
							aria-label="Prioridad hasta {p}">≤{p}</button
						>
					{/each}
				</div>
				<button
					class="btn-primary btn-sm"
					onclick={() => {
						createMode = 'task';
						createPrefillProjectId = null;
						showCreate = true;
					}}
				>
					<i class="fa-solid fa-plus"></i> Tarea
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
					{#if (i > 0 && taskDateKey !== prevDateKey) || (i === 0 && isToday)}
						<div class="agenda-day-divider" class:today={isToday}>
							<span class="agenda-day-line"></span>
							<span class="agenda-day-label">{formatDueDay(taskDate)}</span>
							<span class="agenda-day-line"></span>
						</div>
					{/if}
					<TaskItem
						{task}
<<<<<<< HEAD
						onstart={() => handleTaskStartWithNotification(task.id, task.name, task.project_name)}
=======
						{isToday}
						onstart={() => timer.handleTaskStart(task.id, task.name, task.project_name)}
>>>>>>> develop
						ontoggle={handleTaskToggle}
						ondetail={openTaskDetail}
						isTimerRunning={timer.isRunning}
					/>
				{/each}
				{#if hasMoreDueDateTasks}
					<button class="show-more-btn" onclick={showMoreDueDateTasks}>
						<span class="show-more-line"></span>
						<span class="show-more-pill">
							<i class="fa-solid fa-chevron-down"></i>
							<span>{remainingDueDateTasks} más</span>
						</span>
						<span class="show-more-line"></span>
					</button>
				{/if}
			</div>
		</div>

		<div class="tasks-section">
			<div class="section-header">
				<h2>Proyectos activos</h2>
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
					<i class="fa-solid fa-plus"></i> Proyecto
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
