<script lang="ts">
	import TimePicker from '$lib/shared/components/TimePicker.svelte';
	import TaskItem from '$lib/domains/tasks/components/TaskItem.svelte';
	import TreeNode from '$lib/domains/tasks/components/TreeNode.svelte';
	import { createTaskTimer } from '$lib/domains/tasks/taskTimer.svelte';

	let { data } = $props();

	const timer = createTaskTimer();

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
		<div class="task-selector" class:active={timer.selectedTaskDisplay !== null}>
			{timer.selectedTaskDisplay ?? 'Seleccionar Tarea'}
		</div>

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
					<button class="btn-primary running" onclick={timer.stopTimer}>
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
	</div>

	<div class="tasks-content">
		<div class="tasks-section">
			<h2>Próximas a vencer</h2>
			<div class="task-list">
				{#each data.tasksByDueDate as task (task.id)}
					<TaskItem {task} onstart={() => timer.handleTaskStart(task.id, task.name, task.project_name)} isTimerRunning={timer.isRunning} />
				{/each}
			</div>
		</div>

		<div class="tasks-section">
			<h2>Proyectos activos</h2>
			<div class="task-list">
				<TreeNode nodes={data.activeTree} onstart={(id, name, proj) => timer.handleTaskStart(id, name, proj)} isTimerRunning={timer.isRunning} />
			</div>
		</div>
	</div>
</div>
