import { habitsApi } from '$habits/api/habits.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import type { HabitWithLog } from '$habits/types/Habit.types';

export interface HabitCardApi {
	logHabit: (input: {
		habit_id: number;
		date: string;
		value: number;
	}) => Promise<{ status: string }>;
}

export interface HabitCardCallbacks {
	/** Revalidate page data after a successful log (the component passes `refreshCurrentDate`). */
	onRefresh?: () => void;
	api?: HabitCardApi;
}

/**
 * Per-card controller for `HabitCard`. Owns the optimistic-value state, the logging
 * flow (optimistic set + rollback on error), and the progress/target derivations.
 * Mirrors `TaskTimer` / `TaskBoard`: injected `#api`, injected callback, named methods.
 *
 * `habit` and `currentDate` are live props that change after `onRefresh`, so the
 * controller reads them through the constructor-supplied getters; the derived values
 * are `get` accessors over `#getHabit()` (reactive in templates). The reconciling
 * `$effect` stays in the component, which calls `reconcile()`.
 */
export class HabitCard {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#getHabit: () => HabitWithLog;
	#getCurrentDate: () => string;
	#onRefresh?: () => void;
	#api: HabitCardApi;

	// Public reactive state, read directly by the template.
	optimisticValue = $state<number | null>(null);

	constructor(
		getHabit: () => HabitWithLog,
		getCurrentDate: () => string,
		{ onRefresh, api = habitsApi }: HabitCardCallbacks = {}
	) {
		this.#getHabit = getHabit;
		this.#getCurrentDate = getCurrentDate;
		this.#onRefresh = onRefresh;
		this.#api = api;
	}

	// ── derived view-state (getters: evaluated on access, reactive in templates) ──

	get displayValue(): number {
		return this.optimisticValue ?? this.#getHabit().log_value ?? 0;
	}

	get hasTarget(): boolean {
		const habit = this.#getHabit();
		return habit.target_min !== null || habit.target_max !== null;
	}

	get optimisticPeriodValue(): number {
		const habit = this.#getHabit();
		return this.optimisticValue !== null
			? habit.period_value + (this.optimisticValue - (habit.log_value ?? 0))
			: habit.period_value;
	}

	get progressPct(): number {
		if (!this.hasTarget) return 0;
		const habit = this.#getHabit();
		const min = habit.target_min;
		const max = habit.target_max;
		const periodValue = this.optimisticPeriodValue;
		if (min !== null && max !== null) {
			// Range: position within [min, max]
			if (max === min) return periodValue >= min ? 100 : 0;
			return Math.max(0, Math.min(((periodValue - min) / (max - min)) * 100, 100));
		}
		if (min !== null) {
			// Min-only
			return Math.min((periodValue / min) * 100, 100);
		}
		// Max-only
		return Math.min((periodValue / max!) * 100, 100);
	}

	get targetMet(): boolean {
		if (!this.hasTarget) return false;
		const habit = this.#getHabit();
		const min = habit.target_min;
		const max = habit.target_max;
		const periodValue = this.optimisticPeriodValue;
		if (min !== null && max !== null) {
			return periodValue >= min && periodValue <= max;
		}
		if (min !== null) return periodValue >= min;
		return periodValue <= max!;
	}

	get exceeded(): boolean {
		if (!this.hasTarget) return false;
		const max = this.#getHabit().target_max;
		if (max === null) return false;
		return this.optimisticPeriodValue > max;
	}

	get progressText(): string {
		const habit = this.#getHabit();
		const min = habit.target_min;
		const max = habit.target_max;
		const periodValue = this.optimisticPeriodValue;
		if (min !== null && max !== null) return `${periodValue} (${min}-${max})`;
		if (min !== null) return `${periodValue}/${min}`;
		if (max !== null) return `${periodValue}/${max}`;
		return '';
	}

	// ── reconcile (called by the component's `$effect`) ─────────────────

	/** Clear the optimistic value once the live habit reflects it. */
	reconcile(): void {
		if (this.optimisticValue !== null && this.#getHabit().log_value === this.optimisticValue) {
			this.optimisticValue = null;
		}
	}

	// ── logging ─────────────────────────────────────────────────────────

	async log(newValue: number): Promise<void> {
		if (newValue < 0) newValue = 0;
		this.optimisticValue = newValue;

		try {
			await this.#api.logHabit({
				habit_id: this.#getHabit().id,
				date: this.#getCurrentDate(),
				value: newValue,
			});
			addNotification('Habit logged', 'success');
			this.#onRefresh?.();
		} catch {
			this.optimisticValue = null;
			addToast('Error logging value', 'error');
		}
	}

	increment(): Promise<void> {
		return this.log(this.displayValue + 1);
	}

	decrement(): Promise<void> {
		return this.log(this.displayValue - 1);
	}

	setFromInput(value: number): Promise<void> | void {
		if (isNaN(value)) return;
		return this.log(value);
	}
}
