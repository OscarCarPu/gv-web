<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';
	import HabitCard from '$habits/components/HabitCard.svelte';
	import HabitFormSheet from '$habits/components/HabitFormSheet.svelte';
	import DateNavigation from '$shared/components/DateNavigation.svelte';
	import { toLocalDateString } from '$shared/utils/datetime';

	let { data }: { data: { habits: HabitWithLog[] } } = $props();
	let fetchedHabits: HabitWithLog[] | null = $state(null);
	let habits = $derived(fetchedHabits ?? data.habits);
	let currentDate = $state(toLocalDateString());
	let formOpen = $state(false);
	let editingHabit: HabitWithLog | null = $state(null);

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

	function openCreate() {
		editingHabit = null;
		formOpen = true;
	}

	function openEdit(habit: HabitWithLog) {
		editingHabit = habit;
		formOpen = true;
	}

	function handleClose() {
		formOpen = false;
		editingHabit = null;
		refreshCurrentDate();
	}
</script>

<svelte:head>
	<title>Habitos</title>
</svelte:head>

<div class="container">
	<h1>Habitos</h1>
	<div class="habits-toolbar">
		<DateNavigation onDateChange={handleDateChange} />
		<button class="btn-primary" onclick={openCreate}>+ Nuevo hábito</button>
	</div>

	<div class="habit-list">
		{#each habits as habit (habit.id)}
			<HabitCard
				{habit}
				{currentDate}
				onRefresh={refreshCurrentDate}
				onEdit={() => openEdit(habit)}
			/>
		{/each}
	</div>
</div>

<HabitFormSheet open={formOpen} habit={editingHabit} onclose={handleClose} />
