<script lang="ts">
	import type { HabitDayStats } from '$habits/types/Habit.types';

	let { habit }: { habit: HabitDayStats } = $props();

	function getProgressPercentage(): number {
		if (!habit.target_value || habit.target_value === 0) return 0;
		const current = habit.current_period_value ?? 0;
		const percentage = (current / habit.target_value) * 100;
		return Math.min(percentage, 100);
	}

	function isGoalMet(): boolean {
		if (habit.target_value === null) return false;
		const current = habit.current_period_value ?? 0;

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
		if (habit.target_value === null) return false;
		const current = habit.current_period_value ?? 0;
		const isLimitType =
			habit.comparison_type === 'less_than' || habit.comparison_type === 'less_equal_than';
		return isLimitType && current > habit.target_value;
	}

	function getProgressBarClass(): string {
		if (isExceededLimit()) return 'habit-card__progress-bar--danger';
		if (isGoalMet()) return 'habit-card__progress-bar--success';
		return 'habit-card__progress-bar--info';
	}

	function formatValue(value: number | null): string {
		if (value === null) return '-';
		return value.toString();
	}

	function formatFrequency(freq: string): string {
		const map: Record<string, string> = {
			daily: 'Daily',
			weekly: 'Weekly',
			monthly: 'Monthly',
		};
		return map[freq] ?? freq;
	}

	const isBoolean = $derived(habit.value_type === 'boolean');
	const isToggleOn = $derived(isBoolean && habit.date_value === 1);
</script>

<div class="habit-card {habit.is_required ? 'habit-card--required' : ''}">
	{#if habit.current_streak > 0}
		<div class="habit-card__streak">
			<i class="fa-solid fa-fire"></i>
			<span>{habit.current_streak}</span>
		</div>
	{/if}

	{#if habit.is_required}
		<span class="habit-card__required-badge">Required</span>
	{/if}

	<div class="habit-card__header">
		{#if habit.icon}
			<i class="{habit.icon} habit-card__icon"></i>
		{/if}
		<h2 class="habit-card__title">{habit.name}</h2>
	</div>

	<span class="habit-card__frequency">{formatFrequency(habit.frequency)}</span>

	{#if isBoolean}
		<div
			class="habit-card__toggle {isToggleOn ? 'habit-card__toggle--on' : 'habit-card__toggle--off'}"
		>
			<div class="habit-card__toggle-knob"></div>
		</div>
	{:else}
		<div class="habit-card__value">
			{formatValue(habit.date_value)}
			{#if habit.unit}
				<span class="habit-card__unit">{habit.unit}</span>
			{/if}
		</div>
	{/if}

	{#if habit.target_value !== null}
		<div class="habit-card__progress-container">
			<div class="habit-card__progress">
				<div
					class="habit-card__progress-bar {getProgressBarClass()}"
					style="width: {getProgressPercentage()}%"
				></div>
			</div>
			<p class="habit-card__target">
				{formatValue(habit.current_period_value)} / {habit.target_value}
				{#if habit.unit}
					{habit.unit}
				{/if}
			</p>
		</div>
	{/if}
</div>
