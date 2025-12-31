<script lang="ts">
	import type { HabitDayStats } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';

	let { data }: { data: { habits: HabitDayStats[] } } = $props();
	let fetchedHabits: HabitDayStats[] | null = $state(null);
	let habits = $derived(fetchedHabits ?? data.habits);

	function handleDateChange(date: Date) {
		const dateStr = date.toISOString().split('T')[0];
		habitsApi.getDay(dateStr).then((newHabits) => {
			fetchedHabits = newHabits;
		});
	}
</script>

<svelte:head>
	<title>Habitos</title>
</svelte:head>

<div class="container">
	<h1>Habitos</h1>
	<!-- DateNavigation -->
	<DateNavigation onDateChange={handleDateChange} />
	<!-- Habit List -->
	<div class="habit-list">
		{#each habits as habit (habit.id)}
			<HabitCard {habit} />
		{/each}
	</div>
</div>
