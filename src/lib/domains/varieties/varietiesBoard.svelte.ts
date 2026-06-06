import type { Variety } from '$lib/domains/varieties/types/Variety.types';

/**
 * Owns the varieties page's view logic: the rated/unrated partition (with the
 * ranking order preserved by `getVarieties` ordering), the create-sheet
 * open/close state, and the transient row highlight (the `highlightedId` plus
 * its 1500ms auto-clear timeout). Mirrors `TaskBoard`: injected `getVarieties`
 * accessor, reactive state read directly by the template, getters for derived
 * view-state. The actual DOM scroll stays in the component — this controller
 * only owns `highlightedId` and its timeout.
 */
export class VarietiesBoard {
	// Injected (assigned in constructor; declared first so getters may reference it).
	#getVarieties: () => Variety[];

	#highlightedId = $state<number | null>(null);
	#showCreate = $state(false);

	// Auto-clear timeout for the highlight (owned + cleaned up here).
	#highlightTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(getVarieties: () => Variety[]) {
		this.#getVarieties = getVarieties;
	}

	static #isRated(v: Variety): boolean {
		return v.scent > 0 && v.flavor > 0 && v.power > 0 && v.quality > 0;
	}

	isRated(v: Variety): boolean {
		return VarietiesBoard.#isRated(v);
	}

	// ── derived partition (getters: reactive in templates) ─────────────────

	get rated(): Variety[] {
		return this.#getVarieties().filter((v) => VarietiesBoard.#isRated(v));
	}

	get unrated(): Variety[] {
		return this.#getVarieties().filter((v) => !VarietiesBoard.#isRated(v));
	}

	get highlightedId(): number | null {
		return this.#highlightedId;
	}

	get showCreate(): boolean {
		return this.#showCreate;
	}

	// ── create sheet ───────────────────────────────────────────────────────

	openCreate(): void {
		this.#showCreate = true;
	}

	closeCreate(): void {
		this.#showCreate = false;
	}

	// ── row highlight ────────────────────────────────────────────────────────

	/**
	 * Mark a row highlighted and schedule the 1500ms auto-clear. The component
	 * is responsible for the DOM scroll into view.
	 */
	highlight(id: number): void {
		if (this.#highlightTimeout) clearTimeout(this.#highlightTimeout);
		this.#highlightedId = id;
		this.#highlightTimeout = setTimeout(() => {
			if (this.#highlightedId === id) this.#highlightedId = null;
			this.#highlightTimeout = null;
		}, 1500);
	}
}
