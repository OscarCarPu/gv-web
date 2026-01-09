<script lang="ts">
	import type { HabitDayStats } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';
	import { authStore } from '$shared/stores/auth';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';

	let { data }: { data: { habits: HabitDayStats[]; token?: string } } = $props();
	let fetchedHabits: HabitDayStats[] | null = $state(null);
	let habits = $derived(fetchedHabits ?? data.habits);
	let currentDate = $state(new Date().toISOString().split('T')[0]);

	$effect(() => {
		authStore.setToken(data.token);
	});

	function handleDateChange(date: Date) {
		const dateStr = date.toISOString().split('T')[0];
		currentDate = dateStr;
		habitsApi.getDay(dateStr).then((newHabits) => {
			fetchedHabits = newHabits;
		});
	}

	function refreshCurrentDate() {
		habitsApi.getDay(currentDate).then((newHabits) => {
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
