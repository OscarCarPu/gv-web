import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

/**
 * Pure geometry and editing rules for the agenda view of Today's Plan — the time grid where a
 * block's edges are dragged to change its start/end. Everything here works in epoch ms so the
 * component only converts at the edges (pointer px ↔ ms, ms ↔ ISO for the API).
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
/** Drag and split resolution. */
export const SNAP_MS = 5 * MINUTE_MS;
/** A block can never be dragged (or split) shorter than this. */
export const MIN_BLOCK_MS = SNAP_MS;

export type AgendaEdge = 'start' | 'end';

export interface AgendaRange {
	/** Epoch ms of the first hour line. */
	startMs: number;
	/** Epoch ms of the last hour line. */
	endMs: number;
}

export function snapMs(ms: number, step = SNAP_MS): number {
	return Math.round(ms / step) * step;
}

/** Blocks in chronological order (the API does not promise any order). */
export function sortBlocks(blocks: PlanBlockResponse[]): PlanBlockResponse[] {
	return [...blocks].sort(
		(a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
	);
}

/**
 * The hours the grid shows: whole hours covering every block and "now", never narrower than
 * `minHours` (padded around the default working day) so an empty plan still has room to look at.
 */
export function agendaRange(
	blocks: PlanBlockResponse[],
	nowMs: number,
	defaultFromHour = 8,
	defaultToHour = 20
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
	for (const b of blocks) {
		lo = Math.min(lo, new Date(b.started_at).getTime());
		hi = Math.max(hi, new Date(b.ended_at).getTime());
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
 * How far an edge may travel: up to the neighbouring block (the API rejects overlaps) and never
 * past the block's own other edge minus the minimum length. `sorted` must be chronological.
 */
export function edgeLimits(
	sorted: PlanBlockResponse[],
	index: number,
	edge: AgendaEdge,
	range: AgendaRange
): { min: number; max: number } {
	const b = sorted[index];
	const start = new Date(b.started_at).getTime();
	const end = new Date(b.ended_at).getTime();
	if (edge === 'start') {
		const prev = sorted[index - 1];
		const min = prev ? new Date(prev.ended_at).getTime() : range.startMs;
		return { min, max: end - MIN_BLOCK_MS };
	}
	const next = sorted[index + 1];
	const max = next ? new Date(next.started_at).getTime() : range.endMs;
	return { min: start + MIN_BLOCK_MS, max };
}

/** Snap a dragged edge and keep it inside its limits. */
export function resolveEdge(ms: number, limits: { min: number; max: number }): number {
	return Math.min(limits.max, Math.max(limits.min, snapMs(ms)));
}

/**
 * Where "split in two" cuts: the snapped midpoint. `null` when the block is too short to give
 * both halves the minimum length.
 */
export function splitPoint(b: PlanBlockResponse): number | null {
	const start = new Date(b.started_at).getTime();
	const end = new Date(b.ended_at).getTime();
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
