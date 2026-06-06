import { varietiesApi } from '$lib/domains/varieties/api/varieties.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { clamp } from '$lib/shared/utils/number';
import type { Variety, UpdateVarietyRequest } from '$lib/domains/varieties/types/Variety.types';

export interface VarietyCardApi {
	updateVariety: (id: number, input: UpdateVarietyRequest) => Promise<Variety>;
	deleteVariety: (id: number) => Promise<void>;
}

export interface VarietyCardOptions {
	api?: VarietyCardApi;
	refresh: () => Promise<void>;
}

/**
 * Per-row controller for `VarietyCard`. Owns the editable field mirrors (bound
 * directly via `bind:` in the template), the 400ms debounced autosave, the
 * comments blur-commit flow, and delete. Mirrors `TaskTimer`: injected `#api`,
 * private `#saveTimer` debounce + `#clearTimers`, reactive `$state` fields read
 * directly by the template. The textarea-focus `$effect` stays in the component.
 *
 * The constructor seeds the field mirrors once from the initial `variety`
 * snapshot (the original component used `untrack(() => variety)` for this); the
 * live prop is kept as the diff base / id source via `#variety`, matching the
 * original which read the live `variety` prop in `save`/`commitCommentsEdit`.
 */
export class VarietyCard {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: VarietyCardApi;
	#refresh: () => Promise<void>;

	// The variety this row edits (id source + the comments diff base for blur-commit).
	#variety: Variety;

	// Editable field mirrors (bound directly via `bind:` in the template).
	name = $state('');
	scent = $state<number | null>(null);
	flavor = $state<number | null>(null);
	power = $state<number | null>(null);
	quality = $state<number | null>(null);
	price = $state<number | null>(null);
	comments = $state('');
	judge = $state('');

	// View-only flags.
	#editingComments = $state(false);
	#saving = $state(false);

	// Debounce timer (declared like TaskTimer's `#commentTimeout`).
	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(variety: Variety, { api = varietiesApi, refresh }: VarietyCardOptions) {
		this.#api = api;
		this.#refresh = refresh;
		this.#variety = variety;

		// Seed the local mirrors from the passed variety (mirrors the original
		// component's `untrack(() => variety)` snapshot seeding).
		this.name = variety.name;
		this.scent = variety.scent;
		this.flavor = variety.flavor;
		this.power = variety.power;
		this.quality = variety.quality;
		this.price = variety.price;
		this.comments = variety.comments ?? '';
		this.judge = variety.judge;
	}

	get variety(): Variety {
		return this.#variety;
	}

	get editingComments(): boolean {
		return this.#editingComments;
	}

	get saving(): boolean {
		return this.#saving;
	}

	startEditingComments(): void {
		this.#editingComments = true;
	}

	// ── private helpers ────────────────────────────────────────────────

	#clearTimers(): void {
		if (this.#saveTimer) clearTimeout(this.#saveTimer);
		this.#saveTimer = null;
	}

	// ── autosave ────────────────────────────────────────────────────────

	scheduleSave(): void {
		if (this.#saveTimer) clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.save(), 400);
	}

	async save(): Promise<void> {
		this.#saveTimer = null;
		this.#saving = true;
		try {
			await this.#api.updateVariety(this.#variety.id, {
				name: this.name.trim() || this.#variety.name,
				scent: clamp(this.scent, 0, 10),
				flavor: clamp(this.flavor, 0, 10),
				power: clamp(this.power, 0, 10),
				quality: clamp(this.quality, 0, 10),
				price: this.price ?? 0,
				comments: this.comments.trim() ? this.comments.trim() : null,
				judge: this.judge.trim() || this.#variety.judge,
			});
			addNotification('Variety updated', 'success');
			await this.#refresh();
		} catch {
			addToast('Error saving', 'error');
		} finally {
			this.#saving = false;
		}
	}

	// ── comments blur-commit ──────────────────────────────────────────────

	async commitCommentsEdit(): Promise<void> {
		this.#editingComments = false;
		const next = this.comments.trim() ? this.comments.trim() : null;
		if (next !== (this.#variety.comments ?? null)) {
			this.#clearTimers();
			await this.save();
		}
	}

	// ── delete ────────────────────────────────────────────────────────────

	async remove(): Promise<void> {
		try {
			await this.#api.deleteVariety(this.#variety.id);
			addNotification('Variety deleted', 'success');
			await this.#refresh();
		} catch {
			addToast('Error deleting', 'error');
		}
	}
}
