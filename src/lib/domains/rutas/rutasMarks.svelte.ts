import { SvelteMap } from 'svelte/reactivity';
import { rutasApi } from '$lib/domains/rutas/api/rutas.api';
import { addToast } from '$shared/stores/toast.svelte';
import type {
	ConcelhoFeature,
	CreateMarkPayload,
	LocalMark,
	RutasMark,
	UpdateMarkPayload,
} from '$lib/domains/rutas/types/Rutas.types';

export interface RutasMarksApi {
	create: (payload: CreateMarkPayload) => Promise<RutasMark>;
	update: (id: number, payload: UpdateMarkPayload) => Promise<RutasMark>;
	delete: (id: number) => Promise<void>;
}

/** Build a name→LocalMark map from the SSR-loaded API marks. */
function marksFromApi(apiMarks: RutasMark[]): [string, LocalMark][] {
	return apiMarks.map((mark) => [
		mark.name,
		{
			apiId: mark.id,
			name: mark.name,
			date: mark.visited_on.slice(0, 10),
			description: mark.description,
		},
	]);
}

/**
 * Owns the rutas page's mark state + persistence: the name→LocalMark map, the
 * mark modal, the create/update/delete optimistic flows (with rollback + error
 * toast), and the province filter. Mirrors `TaskBoard`/`TaskTimer`: injected
 * `#api`, named methods, reactive state read directly by the template.
 *
 * The map is a `SvelteMap` mutated in place (`.set` / `.delete`). All d3/geojson
 * concerns stay in the page — the controller only exposes `has()` / `get()` so the
 * page can compute counts over its client-loaded feature list.
 */
export class RutasMarks {
	#api: RutasMarksApi;

	// Marks keyed by concello name (matches API). SvelteMap is already reactive.
	#marks = new SvelteMap<string, LocalMark>();

	// Modal state.
	#modalOpen = $state(false);
	#selectedFeature = $state<ConcelhoFeature | null>(null);
	#saving = $state(false);

	// Province filter.
	#activeProvince = $state<string | null>(null);

	constructor(initialApiMarks: RutasMark[] = [], api: RutasMarksApi = rutasApi) {
		this.#api = api;
		for (const [name, mark] of marksFromApi(initialApiMarks)) {
			this.#marks.set(name, mark);
		}
	}

	// ── reactive accessors read by the template ────────────────────────

	get marks(): SvelteMap<string, LocalMark> {
		return this.#marks;
	}

	get modalOpen(): boolean {
		return this.#modalOpen;
	}

	get selectedFeature(): ConcelhoFeature | null {
		return this.#selectedFeature;
	}

	get saving(): boolean {
		return this.#saving;
	}

	get activeProvince(): string | null {
		return this.#activeProvince;
	}

	// ── map queries (the page computes counts over its features) ────────

	has(name: string): boolean {
		return this.#marks.has(name);
	}

	get(name: string): LocalMark | undefined {
		return this.#marks.get(name);
	}

	// ── province filter ─────────────────────────────────────────────────

	setProvince(province: string | null): void {
		this.#activeProvince = province;
	}

	clearProvince(): void {
		this.#activeProvince = null;
	}

	// ── modal ───────────────────────────────────────────────────────────

	openModal(feature: ConcelhoFeature): void {
		this.#selectedFeature = feature;
		this.#modalOpen = true;
	}

	closeModal(): void {
		this.#modalOpen = false;
		this.#selectedFeature = null;
	}

	// ── persistence (optimistic, rolls back via error toast) ────────────

	/** Create or update the mark for `name`, then close the modal. */
	async save(name: string, payload: { visited_on: string; description: string }): Promise<void> {
		this.#saving = true;
		const existing = this.#marks.get(name);
		try {
			if (existing) {
				const updated = await this.#api.update(existing.apiId, {
					visited_on: payload.visited_on,
					description: payload.description,
				});
				this.#marks.set(name, {
					apiId: updated.id,
					name: updated.name,
					date: updated.visited_on.slice(0, 10),
					description: updated.description,
				});
			} else {
				const created = await this.#api.create({
					name,
					visited_on: payload.visited_on,
					description: payload.description,
				});
				this.#marks.set(name, {
					apiId: created.id,
					name: created.name,
					date: created.visited_on.slice(0, 10),
					description: created.description,
				});
			}
		} catch {
			addToast('Failed to save mark', 'error');
		} finally {
			this.#saving = false;
		}
		this.closeModal();
	}

	/** Delete the mark for `name`, then close the modal. */
	async remove(name: string): Promise<void> {
		const existing = this.#marks.get(name);
		if (!existing) {
			this.closeModal();
			return;
		}
		this.#saving = true;
		try {
			await this.#api.delete(existing.apiId);
			this.#marks.delete(name);
		} catch {
			addToast('Failed to remove mark', 'error');
		} finally {
			this.#saving = false;
		}
		this.closeModal();
	}
}
