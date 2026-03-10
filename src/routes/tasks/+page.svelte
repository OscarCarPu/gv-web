<script lang="ts">
	import TimePicker from '$lib/shared/components/TimePicker.svelte';

	let selectedTask: string | null = $state(null);
	let isRunning = $state(false);
	let elapsedSeconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = $state(null);

	// Placeholder time entries
	let timeEntries = $state([
		{ id: 1, start: '00:00', end: '00:30' }
	]);

	const formattedTime = $derived(() => {
		const h = Math.floor(elapsedSeconds / 3600).toString().padStart(2, '0');
		const m = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
		const s = (elapsedSeconds % 60).toString().padStart(2, '0');
		return `${h}:${m}:${s}`;
	});

	function toggleTimer() {
		if (isRunning) {
			if (timerInterval) clearInterval(timerInterval);
			timerInterval = null;
		} else {
			timerInterval = setInterval(() => {
				elapsedSeconds++;
			}, 1000);
		}
		isRunning = !isRunning;
	}

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
		<button class="task-selector">
			{selectedTask ?? 'Seleccionar Tarea'}
		</button>

		<div class="timer-row">
			<div class="time-entries">
				{#each timeEntries as entry (entry.id)}
					<TimePicker value={entry.start} onchange={(v) => entry.start = v} />
					<span class="time-separator">-</span>
					<TimePicker value={entry.end} onchange={(v) => entry.end = v} />
				{/each}
				<button class="btn-primary" onclick={addTimeEntry}>Agregar</button>
			</div>

			<div class="timer-controls">
				<span class="timer-display">{formattedTime()}</span>
				<button class="btn-primary" class:running={isRunning} onclick={toggleTimer}>
					<i class="fa-solid {isRunning ? 'fa-pause' : 'fa-play'}"></i>
					{isRunning ? 'Pausar' : 'Iniciar'}
				</button>
			</div>
		</div>
	</div>
</div>
