<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';

	let {
		habit,
		currentDate = new Date().toISOString().split('T')[0],
		onRefresh,
	}: {
		habit: HabitWithLog;
		currentDate?: string;
		onRefresh?: () => void;
	} = $props();

	let optimisticValue: number | null = $state(null);
	const displayValue = $derived(optimisticValue ?? habit.log_value ?? 0);

	$effect(() => {
		if (optimisticValue !== null && habit.log_value === optimisticValue) {
			optimisticValue = null;
		}
	});

	async function handleValueChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const newValue = parseFloat(input.value);

		if (isNaN(newValue)) return;

		optimisticValue = newValue;

		try {
			await habitsApi.logHabit({
				habit_id: habit.id,
				date: currentDate,
				value: newValue,
			});
			onRefresh?.();
		} catch {
			optimisticValue = null;
		}
	}
</script>

<div class="habit-card">
	<h2 class="title">{habit.name}</h2>

	{#if habit.description}
		<p class="description">{habit.description}</p>
	{/if}

	<div class="value-controls">
		<div class="value-input">
			<input type="number" value={displayValue} onchange={handleValueChange} />
		</div>
	</div>
</div>
