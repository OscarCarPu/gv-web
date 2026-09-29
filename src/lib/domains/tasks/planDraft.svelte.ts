import { planApi } from '$lib/domains/tasks/api/plan.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import {
	blockSpan,
	planSaveSteps,
	sameSpan,
	type IdSpan,
	type Span,
} from '$lib/domains/tasks/utils/planAgenda';
import type {
	CreatePlanBlockRequest,
	PlanBlockResponse,
	UpdatePlanBlockRequest,
} from '$lib/domains/tasks/types/Plan.types';

interface PlanDraftApi {
	createBlock: (input: CreatePlanBlockRequest) => Promise<unknown>;
	updateBlock: (id: number, input: UpdatePlanBlockRequest) => Promise<unknown>;
}

/** What a new block carries besides its times. */
export type NewBlockFields = Omit<CreatePlanBlockRequest, 'started_at' | 'ended_at'>;

export interface NewBlockDraft {
	/** Negative, so it can never collide with a server id. */
	id: number;
	fields: NewBlockFields;
	/** Shown on the grid: the task's name, or the free-time label. */
	label: string;
	span: Span;
}

/**
 * Unsaved agenda edits for today's plan: new times for existing blocks and blocks that do not
 * exist on the server yet (a create the API refused because it overlapped). Owned by
 * `PlanSection` rather than the agenda component, so the editor can hand it a block and the
 * draft survives switching between list and agenda.
 *
 * Each moved entry remembers the server times it was drafted against (`base`): when the
 * server's times for that block change underneath it (the editor saved it, a refresh brought
 * another change), the entry is stale and ignored — the server wins.
 */
export class PlanDraft {
	moved = $state<Record<number, { span: Span; base: Span }>>({});
	added = $state<NewBlockDraft[]>([]);

	#api: PlanDraftApi;
	#nextId = -1;

	constructor(api: PlanDraftApi = planApi) {
		this.#api = api;
	}

	/** The drafted times for a server block, or null when it has none (or they are stale). */
	spanFor(b: PlanBlockResponse): Span | null {
		const d = this.moved[b.id];
		return d && sameSpan(d.base, blockSpan(b)) ? d.span : null;
	}

	isNew(id: number): boolean {
		return id < 0;
	}

	/** Record where a block was dragged to. `server` is null for a new block. */
	setSpan(id: number, span: Span, server: Span | null): void {
		if (this.isNew(id)) {
			const n = this.added.find((a) => a.id === id);
			if (n) n.span = span;
			return;
		}
		if (!server) return;
		if (sameSpan(span, server)) delete this.moved[id];
		else this.moved[id] = { span, base: server };
	}

	addNew(fields: NewBlockFields, label: string, span: Span): void {
		this.added.push({ id: this.#nextId--, fields, label, span });
	}

	remove(id: number): void {
		if (this.isNew(id)) this.added = this.added.filter((a) => a.id !== id);
		else delete this.moved[id];
	}

	discard(): void {
		this.moved = {};
		this.added = [];
	}

	/** Blocks with unsaved changes, new ones included. */
	dirtyCount(blocks: PlanBlockResponse[]): number {
		let n = this.added.length;
		for (const b of blocks) {
			const span = this.spanFor(b);
			if (span && !sameSpan(span, blockSpan(b))) n++;
		}
		return n;
	}

	/**
	 * Write the draft: `getBlocks` reads the server's blocks (called again after the refresh),
	 * `target` is every block as the grid shows it (server blocks with their
	 * drafted times, plus the new ones). Steps go one at a time in `planSaveSteps` order.
	 * Created blocks leave the draft as soon as they exist, so after a failure the rest can be
	 * saved again without creating anything twice. Returns whether everything went through.
	 */
	async save(
		getBlocks: () => PlanBlockResponse[],
		target: IdSpan[],
		refresh: () => Promise<void>
	): Promise<boolean> {
		const steps = planSaveSteps(
			getBlocks().map((b) => ({ id: b.id, ...blockSpan(b) })),
			target
		);
		if (steps === null) {
			addToast('Some blocks overlap — fix them before saving', 'error');
			return false;
		}

		let ok = true;
		try {
			for (const s of steps) {
				const times = {
					started_at: new Date(s.startMs).toISOString(),
					ended_at: new Date(s.endMs).toISOString(),
				};
				if (s.create) {
					const n = this.added.find((a) => a.id === s.id);
					if (!n) continue;
					await this.#api.createBlock({ ...n.fields, ...times });
					this.remove(s.id);
				} else {
					await this.#api.updateBlock(s.id, times);
				}
			}
		} catch (e: unknown) {
			ok = false;
			addToast(e instanceof Error ? e.message : 'Error saving', 'error');
		}
		await refresh();

		if (ok) {
			this.discard();
		} else {
			// Part of it went through (maybe a block is sitting in a parking minute). Re-anchor
			// what is left to the server's new times so it is not dropped as stale and Save can
			// simply be pressed again.
			for (const b of getBlocks()) {
				const d = this.moved[b.id];
				if (d) d.base = blockSpan(b);
			}
		}
		return ok;
	}
}
