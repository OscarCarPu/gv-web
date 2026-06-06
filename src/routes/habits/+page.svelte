<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { HabitsBoard } from '$habits/habitsBoard.svelte';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import HabitFormSheet from '$habits/components/HabitFormSheet.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';

	let { data }: { data: { habits: HabitWithLog[] } } = $props();
	const board = new HabitsBoard(() => data.habits);
</script>

<svelte:head>
	<title>Habits</title>
</svelte:head>

<div class="container">
	<h1>Habits</h1>
	<div class="habits-toolbar">
		<DateNavigation onDateChange={(date) => board.changeDate(date)} />
		<button class="btn-primary" onclick={() => board.openCreate()}>+ New habit</button>
	</div>

	<div class="habit-list">
		{#each board.habits as habit (habit.id)}
			<HabitCard
				{habit}
				currentDate={board.currentDate}
				onRefresh={() => board.refresh()}
				onEdit={() => board.openEdit(habit)}
			/>
		{/each}
	</div>
</div>

<HabitFormSheet
	open={board.formOpen}
	habit={board.editingHabit}
	onclose={() => board.closeForm()}
/>
