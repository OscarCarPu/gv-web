<script lang="ts">
	import type { HabitDayStats } from '$habits/types/Habit.types';

	let { habit }: { habit: HabitDayStats } = $props();

	function getProgressPercentage(): number {
		const current = habit.current_period_value ?? 0;

		if (habit.comparison_type === 'in_range') {
			if (!habit.target_min || habit.target_min === 0) return 0;
			const percentage = (current / habit.target_min) * 100;
			return Math.min(percentage, 100);
		}

		if (!habit.target_value || habit.target_value === 0) return 0;
		const percentage = (current / habit.target_value) * 100;
		return Math.min(percentage, 100);
	}

	function isGoalMet(): boolean {
		const current = habit.current_period_value ?? 0;

		if (habit.comparison_type === 'in_range') {
			if (habit.target_min === null || habit.target_max === null) return false;
			return current >= habit.target_min && current <= habit.target_max;
		}

		if (habit.target_value === null) return false;

		switch (habit.comparison_type) {
			case 'equals':
				return current === habit.target_value;
			case 'greater_than':
				return current > habit.target_value;
			case 'greater_equal_than':
				return current >= habit.target_value;
			case 'less_than':
				return current < habit.target_value;
			case 'less_equal_than':
				return current <= habit.target_value;
			default:
				return current >= habit.target_value;
		}
	}

	function isExceededLimit(): boolean {
		const current = habit.current_period_value ?? 0;

		if (habit.comparison_type === 'in_range') {
			if (habit.target_max === null) return false;
			return current > habit.target_max;
		}

		if (habit.target_value === null) return false;
		const isLimitType =
			habit.comparison_type === 'less_than' || habit.comparison_type === 'less_equal_than';
		return isLimitType && current > habit.target_value;
	}

	function getProgressBarColor(): string {
		if (isExceededLimit()) return 'bg-danger';
		if (isGoalMet()) return 'bg-success';
		return 'bg-info';
	}

	function formatFrequency(freq: string): string {
		const map: Record<string, string> = {
			daily: 'Daily',
			weekly: 'Weekly',
			monthly: 'Monthly',
		};
		return map[freq] ?? freq;
	}

	function getComparisonSymbol(): string {
		const symbols: Record<string, string> = {
			equals: '=',
			greater_than: '>',
			greater_equal_than: '≥',
			less_than: '<',
			less_equal_than: '≤',
			in_range: '≤',
		};
		return symbols[habit.comparison_type ?? ''] ?? '≥';
	}

	const isRangeType = $derived(habit.comparison_type === 'in_range');
	const hasTarget = $derived(habit.target_value !== null || isRangeType);

	const isBoolean = $derived(habit.value_type === 'boolean');
	const isToggleOn = $derived(isBoolean && habit.date_value === 1);
</script>

<div class="habit-card" class:required={habit.is_required}>
	{#if habit.current_streak > 0 || habit.longest_streak > 0}
		<div class="streak">
			<i class="fa-solid fa-fire"></i>
			<span>{habit.current_streak}</span>
			{#if habit.longest_streak > habit.current_streak}
				<span class="text-text-muted">(Best: {habit.longest_streak})</span>
			{/if}
		</div>
	{/if}

	{#if habit.is_required}
		<span class="required-badge">Required</span>
	{/if}

	<div class="header">
		{#if habit.icon}
			<i class="{habit.icon} icon"></i>
		{/if}
		<h2 class="title">{habit.name}</h2>
	</div>

	<span class="frequency">{formatFrequency(habit.frequency)}</span>

	{#if isBoolean}
		<div class="toggle" class:on={isToggleOn} class:off={!isToggleOn}>
			<div class="knob"></div>
		</div>
	{:else}
		<div class="value">
			{habit.date_value ?? '-'}
			{#if habit.unit}
				<span class="unit">{habit.unit}</span>
			{/if}
		</div>
	{/if}

	{#if hasTarget}
		<div class="progress-container">
			<div class="progress">
				<div
					class="progress-bar {getProgressBarColor()}"
					style="width: {getProgressPercentage()}%"
				></div>
			</div>
			<p class="target">
				{#if isRangeType}
					{habit.target_min} ≤ {habit.current_period_value ?? 0} ≤ {habit.target_max}{habit.unit
						? ` ${habit.unit}`
						: ''}
				{:else}
					{habit.current_period_value ?? 0}
					{getComparisonSymbol()}
					{habit.target_value}{habit.unit ? ` ${habit.unit}` : ''}
				{/if}
			</p>
		</div>
	{/if}

	{#if (habit.average_completion_rate !== null && habit.average_completion_rate > 0) || habit.average_value !== null}
		<div class="stats">
			{#if habit.average_completion_rate !== null && habit.average_completion_rate > 0}
				<span>Avg: {Math.round(habit.average_completion_rate)}%</span>
			{/if}
			{#if habit.average_value !== null}
				<span>Avg: {habit.average_value}{habit.unit ? ` ${habit.unit}` : ''}</span>
			{/if}
		</div>
	{/if}
</div>
