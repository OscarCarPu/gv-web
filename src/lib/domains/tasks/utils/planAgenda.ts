import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

/**
 * Pure geometry and editing rules for the agenda view of Today's Plan — the time grid where
 * blocks are moved and their edges dragged. Everything here works in epoch ms so the component
 * only converts at the edges (pointer px ↔ ms, ms ↔ ISO for the API).
 *
 * Edits land in a local draft first and are saved together. The draft may overlap freely while
 * the user works; only saving needs a non-overlapping result, and `planSaveSteps` finds an
 * order of single-block updates the API (which checks overlap on every PUT) will accept.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
/** Drag and split resolution. */
export const SNAP_MS = 5 * MINUTE_MS;
/** A block can never be dragged (or split) shorter than this. */
export const MIN_BLOCK_MS = SNAP_MS;

export type AgendaEdge = 'start' | 'end';
export type AgendaDragMode = AgendaEdge | 'move';

export interface AgendaRange {
	/** Epoch ms of the first hour line. */
	startMs: number;
	/** Epoch ms of the last hour line. */
	endMs: number;
}

export interface Span {
	startMs: number;
	endMs: number;
}

export interface IdSpan extends Span {
	id: number;
}

export function snapMs(ms: number, step = SNAP_MS): number {
	return Math.round(ms / step) * step;
}

export function blockSpan(b: PlanBlockResponse): Span {
	return { startMs: new Date(b.started_at).getTime(), endMs: new Date(b.ended_at).getTime() };
}

export function spansOverlap(a: Span, b: Span): boolean {
	return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function sameSpan(a: Span, b: Span): boolean {
	return a.startMs === b.startMs && a.endMs === b.endMs;
}

/** Blocks in chronological order (the API does not promise any order). */
export function sortBlocks(blocks: PlanBlockResponse[]): PlanBlockResponse[] {
	return [...blocks].sort(
		(a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
	);
}

/**
 * The hours the grid shows: whole hours covering every span and "now", never narrower than
 * 07:00 to 03:00 of the next day (hours past 23 roll over), so an empty plan still has room
 * to look at and a late evening fits.
 */
export function agendaRange(
	spans: Span[],
	nowMs: number,
	defaultFromHour = 7,
	defaultToHour = 27
): AgendaRange {
	const day = new Date(nowMs);
	day.setHours(0, 0, 0, 0);
	const dayMs = day.getTime();
	const at = (h: number) => {
		const d = new Date(dayMs);
		d.setHours(h, 0, 0, 0);
		return d.getTime();
	};

	let lo = Math.min(at(defaultFromHour), nowMs);
	let hi = Math.max(at(defaultToHour), nowMs);
	for (const s of spans) {
		lo = Math.min(lo, s.startMs);
		hi = Math.max(hi, s.endMs);
	}
	return { startMs: floorHour(lo), endMs: ceilHour(hi) };
}

function floorHour(ms: number): number {
	const d = new Date(ms);
	d.setMinutes(0, 0, 0);
	return d.getTime();
}

function ceilHour(ms: number): number {
	const floored = floorHour(ms);
	if (floored === ms) return ms;
	const d = new Date(floored);
	d.setHours(d.getHours() + 1);
	return d.getTime();
}

/** Every hour line between the range's ends, inclusive. */
export function hourMarks(range: AgendaRange): number[] {
	const marks: number[] = [];
	const d = new Date(range.startMs);
	while (d.getTime() <= range.endMs) {
		marks.push(d.getTime());
		d.setHours(d.getHours() + 1);
	}
	return marks;
}

/**
 * Where a span ends up after dragging by `deltaMs`: an edge snaps and stops short of the other
 * edge; a move snaps its start and keeps the length. Neighbouring blocks are no limit — the
 * draft may overlap — but the span stays inside the grid.
 */
export function dragSpan(
	origin: Span,
	mode: AgendaDragMode,
	deltaMs: number,
	range: AgendaRange
): Span {
	if (mode === 'start') {
		const startMs = clamp(
			snapMs(origin.startMs + deltaMs),
			range.startMs,
			origin.endMs - MIN_BLOCK_MS
		);
		return { startMs, endMs: origin.endMs };
	}
	if (mode === 'end') {
		const endMs = clamp(snapMs(origin.endMs + deltaMs), origin.startMs + MIN_BLOCK_MS, range.endMs);
		return { startMs: origin.startMs, endMs };
	}
	const length = origin.endMs - origin.startMs;
	const startMs = clamp(snapMs(origin.startMs + deltaMs), range.startMs, range.endMs - length);
	return { startMs, endMs: startMs + length };
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, v));
}

/** Ids of every span that overlaps another one. */
export function conflictIds(spans: IdSpan[]): Set<number> {
	const out = new Set<number>();
	const sorted = [...spans].sort((a, b) => a.startMs - b.startMs);
	for (let i = 0; i < sorted.length; i++) {
		for (let j = i + 1; j < sorted.length && sorted[j].startMs < sorted[i].endMs; j++) {
			out.add(sorted[i].id);
			out.add(sorted[j].id);
		}
	}
	return out;
}

/**
 * Side-by-side columns for overlapping spans, like a calendar: each cluster of overlapping
 * spans is split into as many lanes as it needs, and a span alone keeps the full width.
 */
export function layoutLanes(spans: IdSpan[]): Map<number, { lane: number; lanes: number }> {
	const out = new Map<number, { lane: number; lanes: number }>();
	const sorted = [...spans].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
	let cluster: { id: number; lane: number }[] = [];
	let laneEnds: number[] = [];
	let clusterEnd = -Infinity;

	const flush = () => {
		for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
		cluster = [];
		laneEnds = [];
	};

	for (const s of sorted) {
		if (s.startMs >= clusterEnd) flush();
		let lane = laneEnds.findIndex((end) => end <= s.startMs);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(s.endMs);
		} else {
			laneEnds[lane] = s.endMs;
		}
		cluster.push({ id: s.id, lane });
		clusterEnd = Math.max(clusterEnd, s.endMs);
	}
	flush();
	return out;
}

export interface SaveStep extends IdSpan {
	/** A temporary one-minute spot, used to break a cycle (two blocks swapping places). */
	parking: boolean;
	/** A block that only exists in the draft (not in `current`): POST it instead of PUT. */
	create: boolean;
}

/**
 * The single-block writes that take the server from `current` to `target`, ordered so none
 * of them overlaps what is on the server at that moment. A target id missing from `current`
 * is a new block and becomes a create. A block whose target is still taken
 * waits; when every remaining block waits on another (a swap), one is parked in a free minute
 * close to where it is, which frees its slot. Returns null when `target` itself overlaps.
 */
export function planSaveSteps(current: IdSpan[], target: IdSpan[]): SaveStep[] | null {
	if (conflictIds(target).size > 0) return null;

	const state = new Map(current.map((s) => [s.id, { startMs: s.startMs, endMs: s.endMs }]));
	const pending = target
		.filter((t) => {
			const c = state.get(t.id);
			return c === undefined || !sameSpan(c, t);
		})
		.sort((a, b) => a.startMs - b.startMs);
	const steps: SaveStep[] = [];

	const free = (id: number, span: Span) => {
		for (const [otherId, other] of state) {
			if (otherId !== id && spansOverlap(span, other)) return false;
		}
		return true;
	};

	// Each pass either places a block for good or parks one that was never parked before, so
	// this ends in at most 2n passes; the cap is only a guard.
	for (let guard = 0; pending.length > 0 && guard < 4 * target.length + 4; guard++) {
		const i = pending.findIndex((t) => free(t.id, t));
		if (i !== -1) {
			const t = pending.splice(i, 1)[0];
			steps.push({ ...t, parking: false, create: !state.has(t.id) });
			state.set(t.id, { startMs: t.startMs, endMs: t.endMs });
			continue;
		}
		// Only a block already on the server has somewhere to be parked from.
		const stuck = pending.find((t) => state.has(t.id));
		if (!stuck) return null;
		const spot = parkingSpot(stuck.id, state, pending);
		if (!spot) return null;
		state.set(stuck.id, spot);
		steps.push({ id: stuck.id, ...spot, parking: true, create: false });
	}
	return pending.length === 0 ? steps : null;
}

/** A free minute near the block's current start that no pending target needs either. */
function parkingSpot(id: number, state: Map<number, Span>, pending: IdSpan[]): Span | null {
	const origin = state.get(id);
	if (!origin) return null;
	const base = Math.floor(origin.startMs / MINUTE_MS) * MINUTE_MS;
	const taken = (span: Span) => {
		for (const [otherId, other] of state) {
			if (otherId !== id && spansOverlap(span, other)) return true;
		}
		return pending.some((t) => spansOverlap(span, t));
	};
	// Search outward minute by minute, up to half a day either way.
	for (let k = 0; k <= 12 * 60; k++) {
		for (const startMs of k === 0 ? [base] : [base - k * MINUTE_MS, base + k * MINUTE_MS]) {
			const span = { startMs, endMs: startMs + MINUTE_MS };
			if (!taken(span)) return span;
		}
	}
	return null;
}

/**
 * Where "split in two" cuts: the snapped midpoint. `null` when the block is too short to give
 * both halves the minimum length.
 */
export function splitPoint(b: PlanBlockResponse): number | null {
	const { startMs: start, endMs: end } = blockSpan(b);
	if (end - start < 2 * MIN_BLOCK_MS) return null;
	const mid = snapMs(start + (end - start) / 2);
	return Math.min(end - MIN_BLOCK_MS, Math.max(start + MIN_BLOCK_MS, mid));
}

/** Two blocks are "the same task" when they link the same task; free-time blocks never merge. */
export function sameTask(a: PlanBlockResponse, b: PlanBlockResponse): boolean {
	return a.task_id !== null && a.task_id === b.task_id;
}

/** The block after `index` when it can be merged into it, otherwise null. */
export function mergeCandidate(
	sorted: PlanBlockResponse[],
	index: number
): PlanBlockResponse | null {
	const next = sorted[index + 1];
	return next && sameTask(sorted[index], next) ? next : null;
}
