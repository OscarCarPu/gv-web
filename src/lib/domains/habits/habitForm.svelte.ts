import { habitsApi } from '$habits/api/habits.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import type { HabitWithLog } from '$habits/types/Habit.types';

export interface HabitFormApi {
	createHabit: (input: {
		name: string;
		description?: string | null;
		frequency?: string;
		target_min?: number | null;
		target_max?: number | null;
		recording_required?: boolean;
	}) => Promise<{ id: number; name: string; description: string | null }>;
	updateHabit: (
		id: number,
		input: {
			name: string;
			description: string | null;
			frequency: string;
			target_min: number | null;
			target_max: number | null;
			recording_required: boolean;
		}
	) => Promise<{ id: number; name: string; description: string | null }>;
}

export interface HabitFormCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a save (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns `HabitFormSheet`'s logic: the per-field form state, seeding for create/edit,
 * validation, and save (create/update). Mirrors `TaskDetail`: injected `#api`,
 * injected callbacks, named methods, reactive `$state` fields read & `bind:`-ed
 * directly by the template. The open-reset `$effect` stays in the component, which
 * calls `loadFrom(habit)`.
 */
export class HabitForm {
	// Injected (assigned in constructor; declared first).
	#api: HabitFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;

	// The habit being edited (null when creating).
	#habit: HabitWithLog | null = null;

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');
	description = $state('');
	frequency = $state<'daily' | 'weekly' | 'monthly'>('daily');
	targetMin = $state<number | null>(null);
	targetMax = $state<number | null>(null);
	recordingRequired = $state(true);

	// View-only flags.
	saving = $state(false);
	nameError = $state(false);
	targetError = $state(false);

	constructor(api: HabitFormApi = habitsApi, { onclose, refresh }: HabitFormCallbacks) {
		this.#api = api;
		this.#onclose = onclose;
		this.#refresh = refresh;
	}

	// ── seed for create / edit (called by the component's open `$effect`) ──

	loadFrom(habit: HabitWithLog | null): void {
		this.#habit = habit;
		this.name = habit?.name ?? '';
		this.description = habit?.description ?? '';
		this.frequency = (habit?.frequency as 'daily' | 'weekly' | 'monthly') ?? 'daily';
		this.targetMin = habit?.target_min ?? null;
		this.targetMax = habit?.target_max ?? null;
		this.recordingRequired = habit?.recording_required ?? true;
		this.nameError = false;
		this.targetError = false;
	}

	// ── validation ──────────────────────────────────────────────────────

	validate(): boolean {
		if (!this.name.trim()) {
			this.nameError = true;
			return false;
		}
		const min = this.targetMin;
		const max = this.targetMax;
		if (min !== null && min < 0) {
			this.targetError = true;
			return false;
		}
		if (max !== null && max < 0) {
			this.targetError = true;
			return false;
		}
		if (min !== null && max !== null && min > max) {
			this.targetError = true;
			return false;
		}
		return true;
	}

	// ── save ────────────────────────────────────────────────────────────

	async save(): Promise<void> {
		if (!this.validate()) return;
		const min = this.targetMin;
		const max = this.targetMax;

		this.saving = true;
		try {
			if (this.#habit) {
				await this.#api.updateHabit(this.#habit.id, {
					name: this.name.trim(),
					description: this.description.trim() || null,
					frequency: this.frequency,
					target_min: min,
					target_max: max,
					recording_required: this.recordingRequired,
				});
				addNotification('Habit updated', 'success');
			} else {
				await this.#api.createHabit({
					name: this.name.trim(),
					description: this.description.trim() || null,
					frequency: this.frequency,
					target_min: min,
					target_max: max,
					recording_required: this.recordingRequired,
				});
				addNotification('Habit created', 'success');
			}
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error saving habit', 'error');
		} finally {
			this.saving = false;
		}
	}
}
