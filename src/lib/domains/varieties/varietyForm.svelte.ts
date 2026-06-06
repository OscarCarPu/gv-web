import { varietiesApi } from '$lib/domains/varieties/api/varieties.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { clamp } from '$lib/shared/utils/number';
import type { Variety, CreateVarietyRequest } from '$lib/domains/varieties/types/Variety.types';

export interface VarietyFormApi {
	createVariety: (input: CreateVarietyRequest) => Promise<Variety>;
}

export interface VarietyFormCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns `VarietyBottomSheet`'s create-form logic: per-field `$state` (bound
 * directly via `bind:` in the template), `reset()` (called from the open
 * `$effect` in the component), and `create()` (validate name, clamp scores,
 * notify, close, revalidate). Mirrors `TaskDetail`: injected `#api`, injected
 * callbacks, named methods, reactive `$state` form fields.
 */
export class VarietyForm {
	// Injected.
	#api: VarietyFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');
	scent = $state<number | null>(null);
	flavor = $state<number | null>(null);
	power = $state<number | null>(null);
	quality = $state<number | null>(null);
	price = $state<number | null>(null);
	comments = $state('');
	judge = $state('Oscar');

	// View-only flags.
	saving = $state(false);
	nameError = $state(false);

	constructor(api: VarietyFormApi = varietiesApi, { onclose, refresh }: VarietyFormCallbacks) {
		this.#api = api;
		this.#onclose = onclose;
		this.#refresh = refresh;
	}

	/** Reset every field to its blank/default value (called when the sheet opens). */
	reset(): void {
		this.name = '';
		this.scent = null;
		this.flavor = null;
		this.power = null;
		this.quality = null;
		this.price = null;
		this.comments = '';
		this.judge = 'Oscar';
		this.nameError = false;
	}

	clearNameError(): void {
		this.nameError = false;
	}

	async create(): Promise<void> {
		if (!this.name.trim()) {
			this.nameError = true;
			return;
		}
		this.saving = true;
		try {
			await this.#api.createVariety({
				name: this.name.trim(),
				scent: clamp(this.scent, 0, 10),
				flavor: clamp(this.flavor, 0, 10),
				power: clamp(this.power, 0, 10),
				quality: clamp(this.quality, 0, 10),
				price: this.price ?? 0,
				comments: this.comments.trim() ? this.comments.trim() : null,
				judge: this.judge.trim() || 'Oscar',
			});
			addNotification('Variety created', 'success');
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error creating', 'error');
		} finally {
			this.saving = false;
		}
	}
}
