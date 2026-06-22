<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TimePicker from '$lib/shared/components/TimePicker.svelte';
	import TaskItem from '$lib/domains/tasks/components/TaskItem.svelte';
	import TreeNode from '$lib/domains/tasks/components/TreeNode.svelte';
	import TaskBottomSheet from '$lib/domains/tasks/components/TaskBottomSheet.svelte';
	import CreateBottomSheet from '$lib/domains/tasks/components/CreateBottomSheet.svelte';
	import { TaskTimer, type TimerTask } from '$lib/domains/tasks/taskTimer.svelte';
	import { TaskBoard } from '$lib/domains/tasks/taskBoard.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import StartedAtEditor from '$lib/domains/tasks/components/StartedAtEditor.svelte';
	import TimeHistoryModal from '$lib/domains/tasks/components/TimeHistoryModal.svelte';
	import AgendaRightSheet from '$lib/domains/tasks/components/AgendaRightSheet.svelte';
	import TimeEntryBottomSheet from '$lib/domains/tasks/components/TimeEntryBottomSheet.svelte';
	import PlanSection from '$lib/domains/tasks/components/PlanSection.svelte';
	import TimerTaskPicker from '$lib/domains/tasks/components/TimerTaskPicker.svelte';
	import type { TimeEntryWithTask, TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import { toLocalDateString, formatDueDay, formatTime } from '$lib/shared/utils/datetime';
	import { buildPaceTooltip } from '$lib/domains/tasks/utils/paceLabel';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { linkify } from '$lib/shared/utils/linkify';

	let { data } = $props();

	const timer = new TaskTimer();
	const board = new TaskBoard(() => data, invalidateAll);

	let commentExpanded = $state(false);
	let showTimeHistory = $state(false);
	let showAgenda = $state(false);
	let selectedTimeEntry = $state<TimeEntryWithTask | null>(null);

	let todayKey = $derived(toLocalDateString());
	let summary = $derived(board.summary);
	let dailyTarget = $derived(summary.daily_target_seconds);
	let dailyTargetLabel = $derived(formatTime(summary.daily_target_seconds));
	let weekTargetTooltip = $derived(buildPaceTooltip(summary));

	async function handleStop() {
		commentExpanded = false;
		addNotification('Time logged', 'success');
		await timer.finish();
		await board.refreshSummary();
	}

	async function handleCancel() {
		commentExpanded = false;
		timeEntries = [{ id: 1, start: '10:00', end: '11:00' }];
		addNotification('Time cancelled', 'success');
		await timer.cancelTimer();
		await board.refreshSummary();
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

	// Shared timer-button handlers — wired identically into all three task sections.
	function timerStart(task: TimerTask) {
		addNotification('Timer started', 'success');
		return timer.start(task);
	}

	function timerAssign(task: TimerTask) {
		addNotification('Timer started', 'success');
		return timer.replaceForTaskId(task);
	}

	// Timer-panel "Select Task" picker: start a new entry when idle, reassign when running.
	function pickTask(task: TaskListItem) {
		const timerTask: TimerTask = { id: task.id, name: task.name, projectName: task.project_name };
		if (timer.isRunning) timerAssign(timerTask);
		else timerStart(timerTask);
	}

	async function timerStopAndStart(task: TimerTask) {
		addNotification('Timer started', 'success');
		await timer.stopAndStart(task);
		await board.refreshSummary();
	}

	let selectedTaskId = $state<number | null>(null);
	let showCreate = $state(false);
	let createMode = $state<'task' | 'project'>('task');
	let createPrefillProjectId = $state<number | null>(null);

	function openTaskDetail(id: number) {
		selectedTaskId = id;
	}

	function handleAgendaEntryClick(entry: TimeEntryWithTask) {
		showAgenda = false;
		selectedTimeEntry = entry;
	}

	async function handleTimeEntryUpdated() {
		await board.refreshSummary();
	}

	async function handleTimeEntryDeleted() {
		await board.refreshSummary();
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
			timer.restore(data.activeTimeEntry);
		}
	});

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
		addNotification('Time logged', 'success');
		await tasksApi.updateTimeEntry(entryId, {
			started_at: startedAt.toISOString(),
			finished_at: finishedAt.toISOString(),
			comment: entryComment || null,
		});
		await board.refreshSummary();
	}
</script>

<svelte:head>
	<title>Tasks</title>
</svelte:head>

<div class="container">
	<h1>Tasks</h1>

	<div class="task-timer-row">
		<div class="task-timer-panel">
			<div class="task-header">
				<button
					class="comment-toggle"
					class:has-comment={timer.comment.length > 0}
					onclick={() => {
						commentExpanded = !commentExpanded;
					}}
					title="Comment"
				>
					<Icon name="comment" />
				</button>
				<button
					id="timer-task-selector"
					class="task-selector"
					class:active={timer.selectedTaskDisplay !== null}
				>
					{timer.selectedTaskDisplay ?? 'Select Task'}
				</button>
				<TimerTaskPicker
					triggerId="timer-task-selector"
					onselect={pickTask}
					currentTaskId={timer.selectedTaskId}
					onopendetail={() => {
						if (timer.selectedTaskId) openTaskDetail(timer.selectedTaskId);
					}}
				/>
				<button
					class="btn-cancel"
					onclick={handleCancel}
					disabled={!timer.activeTimeEntryId}
					title="Cancel entry"><Icon name="xmark" /></button
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
					placeholder="Comment..."
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
						><Icon name="plus" /> Add</button
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
						<button class="btn-primary" onclick={() => timer.startClock()}>
							<Icon name="play" />
							Start
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
					<span class="summary-label">Today</span>
					<div class="progress-track bg-bg">
						<div
							class="progress-fill"
							style="width: {Math.min((summary.today / dailyTarget) * 100, 100)}%"
						></div>
					</div>
					<span class="summary-value">{formatTime(summary.today)} / {dailyTargetLabel}</span>
				</div>
				<div class="summary-item" class:completed={summary.week >= summary.weekly_target_seconds}>
					<span class="summary-label">Week</span>
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
						aria-label="View history"
					>
						<Icon name="chart-line" />
					</button>
					<button class="btn-icon" onclick={() => (showAgenda = true)} aria-label="View agenda">
						<Icon name="calendar-day" />
					</button>
				</div>
			</div>
		</div>

		<aside class="task-shortcuts-panel" aria-label="Quick actions">
			<button
				class="task-shortcut"
				onclick={() => scrollToSection('plan-section')}
				title="Go to Today's Plan"
			>
				<Icon name="calendar-day" />
				<span>Plan</span>
			</button>
			<button
				class="task-shortcut"
				onclick={() => scrollToSection('active-projects-section')}
				title="Go to Active Projects"
			>
				<Icon name="folder" />
				<span>Projects</span>
			</button>
		</aside>
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<div class="section-header">
				<h2>Due Soon <span class="summary-pace">{board.dueTodayCount}</span></h2>

				<div class="priority-filter">
					{#each [1, 2, 3, 4] as p (p)}
						<button
							class:active={board.duePriorityFilter === p}
							onclick={() => board.setDuePriority(p)}
							aria-label="Priority up to {p}">≤{p}</button
						>
					{/each}
					<button
						class:active={board.duePriorityFilter === null}
						onclick={() => board.setDuePriority(null)}>All</button
					>
					{#if board.dueProjectOptions.length > 0}
						<span class="filter-sep" aria-hidden="true">|</span>
						<select
							class="project-filter-select"
							class:active={board.dueProjectFilter !== null}
							value={board.dueProjectFilter}
							onchange={(e) =>
								board.setDueProject(
									e.currentTarget.value === '' ? null : Number(e.currentTarget.value)
								)}
							aria-label="Filter by project"
						>
							<option value={null}>Project</option>
							{#each board.dueProjectOptions as opt (opt.id)}
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
					<Icon name="plus" /> Task
				</button>
			</div>
			<div class="task-list">
				{#each board.visibleDueDateTasks as task, i (task.id)}
					{@const taskDate = task.due_at ?? task.project_due_at}
					{@const taskDateKey = taskDate ? taskDate.slice(0, 10) : 'no-date'}
					{@const prevTask = board.visibleDueDateTasks[i - 1]}
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
						onstart={timerStart}
						onassign={timerAssign}
						onstopandstart={timerStopAndStart}
						ontoggle={(id, action) => board.toggleTask(id, action)}
						ondetail={openTaskDetail}
						isTimerRunning={timer.isRunning}
					/>
				{/each}
				{#if board.hasMoreDueDateTasks}
					<button class="show-more-btn" onclick={() => board.showMore()}>
						<span class="show-more-line"></span>
						<span class="show-more-pill">
							<Icon name="chevron-down" />
							<span>{board.remainingDueDateTasks} more</span>
						</span>
						<span class="show-more-line"></span>
					</button>
				{/if}
			</div>
		</div>

		<PlanSection
			initial={data.plan}
			onstart={timerStart}
			onassign={timerAssign}
			onstopandstart={timerStopAndStart}
			onafterchange={() => invalidateAll()}
			isTimerRunning={timer.isRunning}
			activeStartedAt={timer.isRunning ? (timer.startedAtDate?.toISOString() ?? null) : null}
		/>
	</div>

	<div class="tasks-content tasks-content-wide">
		<div id="active-projects-section" class="tasks-section">
			<div class="section-header">
				<div class="section-title">
					<h2>Active Projects</h2>
					<button class="btn-icon back-to-top" onclick={scrollToTop} title="Back to top">
						<Icon name="arrow-up" />
					</button>
				</div>
				<div class="priority-filter">
					<button
						class:active={board.treePriorityFilter === null}
						onclick={() => board.setTreePriority(null)}>All</button
					>
					{#each [1, 2, 3, 4] as p (p)}
						<button
							class:active={board.treePriorityFilter === p}
							onclick={() => board.setTreePriority(p)}
							aria-label="Priority up to {p}">≤{p}</button
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
					<Icon name="plus" /> Project
				</button>
			</div>
			<div class="task-list">
				<TreeNode
					nodes={board.filteredActiveTree}
					onstart={timerStart}
					onassign={timerAssign}
					onstopandstart={timerStopAndStart}
					ontoggle={(id, type, action) => board.toggleTreeNode(id, type, action)}
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
	onopenentry={handleAgendaEntryClick}
/>
<TimeEntryBottomSheet
	entry={selectedTimeEntry}
	onclose={() => (selectedTimeEntry = null)}
	onupdated={handleTimeEntryUpdated}
	ondeleted={handleTimeEntryDeleted}
/>
