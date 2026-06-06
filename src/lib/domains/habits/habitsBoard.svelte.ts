import { habitsApi } from '$habits/api/habits.api';
import { toLocalDateString } from '$shared/utils/datetime';
import type { HabitWithLog } from '$habits/types/Habit.types';

export interface HabitsBoardApi {
	getHabits: (date?: string, token?: string) => Promise<HabitWithLog[]>;
}

export interface HabitsBoardOptions {
	api?: HabitsBoardApi;
}

/**
 * Owns the habits page's logic: the SSR-vs-fetched habits override, the current date,
 * date navigation (fetch on change), the post-mutation refresh, and the form
 * open/edit/close state. Mirrors `TaskBoard`: injected `#api`, named methods,
 * reactive state read directly by the template.
 */
export class HabitsBoard {
	// Injected (the getter keeps the SSR `data.habits` reactive, like `TaskBoard`).
	#getInitialHabits: () => HabitWithLog[];
	#api: HabitsBoardApi;

	// Override of the SSR habits once a date has been fetched.
	#fetchedHabits = $state<HabitWithLog[] | null>(null);

	currentDate = $state(toLocalDateString());

	// Form state.
	formOpen = $state(false);
	editingHabit = $state<HabitWithLog | null>(null);

	constructor(
		getInitialHabits: () => HabitWithLog[],
		{ api = habitsApi }: HabitsBoardOptions = {}
	) {
		this.#getInitialHabits = getInitialHabits;
		this.#api = api;
	}

	get habits(): HabitWithLog[] {
		return this.#fetchedHabits ?? this.#getInitialHabits();
	}

	// ── date navigation ─────────────────────────────────────────────────

	changeDate(date: Date): void {
		const dateStr = toLocalDateString(date);
		this.currentDate = dateStr;
		this.#api.getHabits(dateStr).then((newHabits) => {
			this.#fetchedHabits = newHabits;
		});
	}

	refresh(): void {
		this.#api.getHabits(this.currentDate).then((newHabits) => {
			this.#fetchedHabits = newHabits;
		});
	}

	// ── form open / edit / close ────────────────────────────────────────

	openCreate(): void {
		this.editingHabit = null;
		this.formOpen = true;
	}

	openEdit(habit: HabitWithLog): void {
		this.editingHabit = habit;
		this.formOpen = true;
	}

	closeForm(): void {
		this.formOpen = false;
		this.editingHabit = null;
		this.refresh();
	}
}
