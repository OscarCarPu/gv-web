<script lang="ts">
	import type { HabitWithLog } from '$habits/types/Habit.types';
	import { habitsApi } from '$habits/api/habits.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { toLocalDateString } from '$shared/utils/datetime';
	import HabitHistoryModal from './HabitHistoryModal.svelte';

	let {
		habit,
		currentDate = toLocalDateString(),
		onRefresh,
	}: {
		habit: HabitWithLog;
		currentDate?: string;
		onRefresh?: () => void;
	} = $props();

	let optimisticValue: number | null = $state(null);
	let showHistory = $state(false);
	const displayValue = $derived(optimisticValue ?? habit.log_value ?? 0);

	const hasTarget = $derived(habit.target_min !== null || habit.target_max !== null);
	const optimisticPeriodValue = $derived(
		optimisticValue !== null
			? habit.period_value + (optimisticValue - (habit.log_value ?? 0))
			: habit.period_value
	);

	const progressPct = $derived.by(() => {
		if (!hasTarget) return 0;
		const min = habit.target_min;
		const max = habit.target_max;
		if (min !== null && max !== null) {
			// Range: position within [min, max]
			if (max === min) return optimisticPeriodValue >= min ? 100 : 0;
			return Math.max(0, Math.min(((optimisticPeriodValue - min) / (max - min)) * 100, 100));
		}
		if (min !== null) {
			// Min-only
			return Math.min((optimisticPeriodValue / min) * 100, 100);
		}
		// Max-only
		return Math.min((optimisticPeriodValue / max!) * 100, 100);
	});

	const targetMet = $derived.by(() => {
		if (!hasTarget) return false;
		const min = habit.target_min;
		const max = habit.target_max;
		if (min !== null && max !== null) {
			return optimisticPeriodValue >= min && optimisticPeriodValue <= max;
		}
		if (min !== null) return optimisticPeriodValue >= min;
		return optimisticPeriodValue <= max!;
	});

	const exceeded = $derived.by(() => {
		if (!hasTarget) return false;
		const max = habit.target_max;
		if (max === null) return false;
		return optimisticPeriodValue > max;
	});

	const progressText = $derived.by(() => {
		const min = habit.target_min;
		const max = habit.target_max;
		if (min !== null && max !== null) return `${optimisticPeriodValue} (${min}-${max})`;
		if (min !== null) return `${optimisticPeriodValue}/${min}`;
		if (max !== null) return `${optimisticPeriodValue}/${max}`;
		return '';
	});

	$effect(() => {
		if (optimisticValue !== null && habit.log_value === optimisticValue) {
			optimisticValue = null;
		}
	});

	async function logValue(newValue: number) {
		if (newValue < 0) newValue = 0;
		optimisticValue = newValue;

		try {
			await habitsApi.logHabit({
				habit_id: habit.id,
				date: currentDate,
				value: newValue,
			});
			addNotification('Hábito registrado', 'success');
			onRefresh?.();
		} catch {
			optimisticValue = null;
			addToast('Error al registrar valor', 'error');
		}
	}

	async function handleValueChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const newValue = parseFloat(input.value);
		if (isNaN(newValue)) return;
		await logValue(newValue);
	}
</script>

<div class="habit-card">
	<button class="history-btn" onclick={() => showHistory = !showHistory} aria-label="Ver historial">
		<i class="fa-solid fa-chart-line"></i>
	</button>
	<div class="habit-header">
		<h2 class="title">{habit.name}</h2>
		{#if habit.recording_required}
			<i class="fa-solid fa-flag required-flag"></i>
		{/if}
		{#if habit.frequency !== 'daily'}
			<span class="frequency-badge">{habit.frequency}</span>
		{/if}
	</div>

	{#if habit.description}
		<p class="description">{habit.description}</p>
	{/if}

	<div class="value-controls">
		<button class="adjust-btn" onclick={() => logValue(displayValue - 1)} aria-label="Decrease value">
			<i class="fa-solid fa-minus"></i>
		</button>
		<div class="value-input">
			<input type="number" value={displayValue} onchange={handleValueChange} />
		</div>
		<button class="adjust-btn" onclick={() => logValue(displayValue + 1)} aria-label="Increase value">
			<i class="fa-solid fa-plus"></i>
		</button>
	</div>

	{#if hasTarget}
		<div class="progress-section">
			<div class="progress-track" class:met={targetMet} class:exceeded={exceeded}>
				<div class="progress-fill" style="width: {progressPct}%"></div>
			</div>
			<span class="progress-text">{progressText}</span>
		</div>
	{:else if habit.frequency !== 'daily'}
		<span class="period-value">{habit.frequency}: {optimisticPeriodValue}</span>
	{/if}

	{#if hasTarget}
		<div class="streaks">
			<span class="streak current" class:active={habit.current_streak > 0}>
				<i class="fa-solid fa-fire"></i> {habit.current_streak}
			</span>
			<span class="streak longest">
				<i class="fa-solid fa-trophy"></i> {habit.longest_streak}
			</span>
		</div>
	{/if}
</div>

<HabitHistoryModal {habit} open={showHistory} onclose={() => showHistory = false} />
