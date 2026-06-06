<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { HabitCard } from './habitCard.svelte';
	import { toLocalDateString } from '$shared/utils/datetime';
	import HabitHistoryModal from './HabitHistoryModal.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	let {
		habit,
		currentDate = toLocalDateString(),
		onRefresh,
		onEdit,
	}: {
		habit: HabitWithLog;
		currentDate?: string;
		onRefresh?: () => void;
		onEdit?: () => void;
	} = $props();

	let showHistory = $state(false);

	const card = new HabitCard(
		() => habit,
		() => currentDate,
		{ onRefresh: () => onRefresh?.() }
	);

	$effect(() => card.reconcile());

	function handleValueChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		card.setFromInput(parseFloat(input.value));
	}
</script>

<div class="habit-card">
	{#if onEdit}
		<button class="edit-btn" onclick={onEdit} aria-label="Edit habit">
			<Icon name="pen" />
		</button>
	{/if}
	<button
		class="history-btn"
		onclick={() => (showHistory = !showHistory)}
		aria-label="View history"
	>
		<Icon name="chart-line" />
	</button>
	<div class="habit-header">
		<h2 class="title">{habit.name}</h2>
		{#if habit.recording_required}
			<Icon name="flag" class="required-flag" />
		{/if}
		{#if habit.frequency !== 'daily'}
			<span class="frequency-badge">{habit.frequency}</span>
		{/if}
	</div>

	{#if habit.description}
		<p class="description">{habit.description}</p>
	{/if}

	<div class="value-controls">
		<button class="adjust-btn" onclick={() => card.decrement()} aria-label="Decrease value">
			<Icon name="minus" />
		</button>
		<div class="value-input">
			<input type="number" value={card.displayValue} onchange={handleValueChange} />
		</div>
		<button class="adjust-btn" onclick={() => card.increment()} aria-label="Increase value">
			<Icon name="plus" />
		</button>
	</div>

	{#if card.hasTarget}
		<div class="progress-section">
			<div class="progress-track" class:met={card.targetMet} class:exceeded={card.exceeded}>
				<div class="progress-fill" style="width: {card.progressPct}%"></div>
			</div>
			<span class="progress-text">{card.progressText}</span>
		</div>
	{:else if habit.frequency !== 'daily'}
		<span class="period-value">{habit.frequency}: {card.optimisticPeriodValue}</span>
	{/if}

	{#if card.hasTarget}
		<div class="streaks">
			<span class="streak current" class:active={habit.current_streak > 0}>
				<Icon name="fire" />
				{habit.current_streak}
			</span>
			<span class="streak longest">
				<Icon name="trophy" />
				{habit.longest_streak}
			</span>
		</div>
	{/if}
</div>

<HabitHistoryModal {habit} open={showHistory} onclose={() => (showHistory = false)} />
