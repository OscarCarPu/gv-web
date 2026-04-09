<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';
import { toLocalDateString } from '$shared/utils/datetime';

	let { data }: { data: { habits: HabitWithLog[] } } = $props();
	let fetchedHabits: HabitWithLog[] | null = $state(null);
	let habits = $derived(fetchedHabits ?? data.habits);
	let currentDate = $state(toLocalDateString());

	function handleDateChange(date: Date) {
		const dateStr = toLocalDateString(date);
		currentDate = dateStr;
		habitsApi.getHabits(dateStr).then((newHabits) => {
			fetchedHabits = newHabits;
		});
	}

	function refreshCurrentDate() {
		habitsApi.getHabits(currentDate).then((newHabits) => {
			fetchedHabits = newHabits;
		});
	}
</script>

<svelte:head>
	<title>Habitos</title>
</svelte:head>

<div class="container">
	<h1>Habitos</h1>
	<DateNavigation onDateChange={handleDateChange} />

	<div class="habit-list">
		{#each habits as habit (habit.id)}
			<HabitCard {habit} {currentDate} onRefresh={refreshCurrentDate} />
		{/each}
	</div>
</div>
