<script lang="ts">
	import type { Habit, PaginatedResponse } from '$habits/types/Habit.types';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';

	let { data }: { data: { habits: PaginatedResponse<Habit> } } = $props();
</script>

<svelte:head>
	<title>Habitos</title>
</svelte:head>

<div class="container">
	<h1>Habitos</h1>
	<!-- DateNavigation -->
	<DateNavigation />
	<!-- Habit List -->
	<div class="habit-list">
		{#each data.habits.items as habit}
			<HabitCard {habit} />
		{/each}
	</div>
</div>
