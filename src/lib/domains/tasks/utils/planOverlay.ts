import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

/** Holes shorter than this are rounding noise, not gaps. Matches the agenda timeline. */
export const GAP_THRESHOLD_SECONDS = 120;

/** Work that actually happened, clamped to the past. Replaces the block that planned it. */
export interface PlanActualItem {
	kind: 'actual';
	entryId: number;
	taskId: number;
	taskName: string;
	projectName: string | null;
	comment: string | null;
	startedAt: string;
	endedAt: string;
	seconds: number;
	running: boolean;
	/** The block this fulfils — same task, overlapping time — or null when there wasn't one. */
	block: PlanBlockResponse | null;
	/** Planned duration of `block`, for the "did 0:27 of 1:00" shortfall read. */
	plannedSeconds: number;
	/**
	 * The task is planned today but this work fell outside its slot. `block` is null while
	 * `offScheduleBlock` names the slot it belongs to — the day's intent was honoured, the
	 * timing slipped. Distinct from `unplanned`, which means the plan never mentions the task.
	 */
	offScheduleBlock: PlanBlockResponse | null;
	/** No block anywhere in today's plan asked for this task. */
	unplanned: boolean;
}

/** A past free-time block nothing was logged against: the break actually happened. */
export interface PlanRestItem {
	kind: 'rest';
	block: PlanBlockResponse;
	seconds: number;
}

/** A past block that did not happen: a task block never worked, or a break worked through. */
export interface PlanSkippedItem {
	kind: 'skipped';
	block: PlanBlockResponse;
	seconds: number;
	/** True for a free block that was overridden by real work. */
	workedThrough: boolean;
	/** The task was worked today, just not in this slot — "done at another time", not "not done". */
	movedElsewhere: boolean;
}

/** Unaccounted stretch of the past. */
export interface PlanGapItem {
	kind: 'gap';
	from: string;
	to: string;
	seconds: number;
}

export interface PlanNowItem {
	kind: 'now';
	ms: number;
}

/** Still-to-come intent, straight from the plan. */
export interface PlanPlannedItem {
	kind: 'planned';
	block: PlanBlockResponse;
	/** Whole block, or only the part after now when the block is in progress. */
	remainingSeconds: number;
	current: boolean;
}

export interface PlanHeadingItem {
	kind: 'heading';
	section: 'past' | 'future';
}

export type PlanTimelineItem =
	| PlanActualItem
	| PlanRestItem
	| PlanSkippedItem
	| PlanGapItem
	| PlanNowItem
	| PlanPlannedItem
	| PlanHeadingItem;

export interface PlanTimelineTotals {
	/** Everything logged today, planned or not. */
	doneSeconds: number;
	/** Logged against a task the plan asked for, in or out of its slot. */
	onPlanSeconds: number;
	/** Planned work done outside its slot — counted inside `onPlanSeconds` too. */
	offScheduleSeconds: number;
	/** Logged with no block anywhere in today's plan asking for it. */
	unplannedSeconds: number;
	/** Planned time still ahead of now (current block counted from now). */
	remainingPlannedSeconds: number;
	/** Planned task time that came and went with nothing logged. */
	skippedSeconds: number;
	/** Breaks taken as planned. */
	restSeconds: number;
	/** Past time no row accounts for — not worked, not rested, not even planned and skipped. */
	gapSeconds: number;
}

export interface PlanTimeline {
	items: PlanTimelineItem[];
	totals: PlanTimelineTotals;
}

interface Interval {
	start: number;
	end: number;
}

function ms(iso: string): number {
	return new Date(iso).getTime();
}

function overlap(a: Interval, b: Interval): number {
	return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function startOfDay(atMs: number): number {
	const d = new Date(atMs);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function blockSeconds(b: PlanBlockResponse): number {
	return Math.max(0, (ms(b.ended_at) - ms(b.started_at)) / 1000);
}

/**
 * Fold today's real time entries over today's plan.
 *
 * Everything before `nowMs` is rebuilt from what actually happened: each entry becomes an
 * `actual` row at its real clock position, attributed to the block that planned it when one
 * matches (same task, overlapping window) and flagged `unplanned` when none does. Blocks that
 * came and went unworked collapse to `skipped`; planned breaks nothing ran through become
 * `rest`; the leftovers become `gap`. Everything after `nowMs` stays untouched intent
 * (`planned`), with the in-progress block contributing only its remainder.
 *
 * Pure — blocks + entries + now in, items + totals out.
 */
export function buildPlanTimeline(input: {
	blocks: PlanBlockResponse[];
	entries: TimeEntryWithTask[];
	nowMs: number;
}): PlanTimeline {
	const { blocks, entries, nowMs } = input;
	const dayStart = startOfDay(nowMs);

	// ── 1. Actuals: clamp every entry into [dayStart, now] and attribute it to a block ──
	const actuals: PlanActualItem[] = [];
	for (const e of entries) {
		const running = e.finished_at === null;
		const rawStart = ms(e.started_at);
		const rawEnd = running ? nowMs : ms(e.finished_at!);
		const start = Math.max(rawStart, dayStart);
		// `nowMs` is only re-ticked once a minute, so an entry started seconds ago can sit ahead
		// of it. Clamping up to `start` keeps a freshly-started timer visible at 0s instead of
		// computing a negative span and vanishing until the next tick.
		// Clamp to the past, but never let the clamp invert the interval.
		const end = Math.max(Math.min(rawEnd, nowMs), start);
		const seconds = (end - start) / 1000;
		// A finished entry with nothing in the past is either data noise or dated in the future —
		// neither belongs in "what I did". A *running* entry is exempt: it is live by definition,
		// and one started a moment ago can legitimately sit ahead of `nowMs`.
		// Callers must re-tick `nowMs` when the entry set changes, or a just-stopped short entry
		// looks future-dated — see `PlanSection`.
		if (seconds <= 0 && !running) continue;

		// Best match = the same-task block sharing the most time with this entry. Failing that,
		// the earliest same-task block anywhere today — the work happened off-schedule.
		//
		// Match against a probe at least 1ms wide: a timer started this second has a zero-length
		// span, which overlaps nothing, and would otherwise be misread as off-schedule work even
		// while sitting squarely inside its own block.
		const probe: Interval = { start, end: Math.max(end, start + 1) };
		let block: PlanBlockResponse | null = null;
		let offScheduleBlock: PlanBlockResponse | null = null;
		let best = 0;
		for (const b of blocks) {
			if (b.task_id !== e.task_id) continue;
			const shared = overlap(probe, { start: ms(b.started_at), end: ms(b.ended_at) });
			if (shared > best) {
				best = shared;
				block = b;
			}
			if (offScheduleBlock === null || ms(b.started_at) < ms(offScheduleBlock.started_at)) {
				offScheduleBlock = b;
			}
		}

		actuals.push({
			kind: 'actual',
			entryId: e.id,
			taskId: e.task_id,
			taskName: e.task_name,
			projectName: e.project_name,
			comment: e.comment,
			startedAt: new Date(start).toISOString(),
			endedAt: new Date(end).toISOString(),
			seconds,
			running,
			block,
			plannedSeconds: block ? blockSeconds(block) : 0,
			offScheduleBlock: block === null ? offScheduleBlock : null,
			unplanned: block === null && offScheduleBlock === null,
		});
	}
	actuals.sort((a, b) => ms(a.startedAt) - ms(b.startedAt));

	const fulfilledBlockIds = new Set(
		actuals.filter((a) => a.block !== null).map((a) => a.block!.id)
	);
	/** Tasks worked at some point today, wherever it happened. */
	const workedTaskIds = new Set(actuals.map((a) => a.taskId));
	const occupied: Interval[] = actuals.map((a) => ({ start: ms(a.startedAt), end: ms(a.endedAt) }));

	// ── 2. Past blocks that produced no actual row of their own ──
	const restItems: PlanRestItem[] = [];
	const skippedItems: PlanSkippedItem[] = [];
	const future: PlanPlannedItem[] = [];

	for (const b of blocks) {
		const start = ms(b.started_at);
		const end = ms(b.ended_at);

		if (end > nowMs) {
			future.push({
				kind: 'planned',
				block: b,
				remainingSeconds: Math.max(0, (end - Math.max(start, nowMs)) / 1000),
				current: start <= nowMs && nowMs < end,
			});
			// A block straddling now may also have already-logged time; that time is already
			// represented by its `actual` row, so nothing more to add here.
			continue;
		}

		// Fully past.
		if (b.task_id === null) {
			// Free block: honoured when no real work ran through it.
			const worked = occupied.some((o) => overlap(o, { start, end }) > 0);
			if (worked) {
				skippedItems.push({
					kind: 'skipped',
					block: b,
					seconds: blockSeconds(b),
					workedThrough: true,
					movedElsewhere: false,
				});
			} else {
				restItems.push({ kind: 'rest', block: b, seconds: blockSeconds(b) });
			}
			continue;
		}

		// Task block: nothing logged inside its window. Either the task was worked at some other
		// hour today (moved) or it simply did not happen.
		if (!fulfilledBlockIds.has(b.id)) {
			skippedItems.push({
				kind: 'skipped',
				block: b,
				seconds: blockSeconds(b),
				workedThrough: false,
				movedElsewhere: b.task_id !== null && workedTaskIds.has(b.task_id),
			});
		}
	}

	// ── 3. Gaps: past time no other row already accounts for ──
	// Skipped blocks are included here on purpose. Their row already explains the hole, so
	// emitting a gap over the same minutes would report it twice; `gapSeconds` therefore means
	// time the day cannot explain at all.
	const consuming: { start: number; end: number }[] = [
		...occupied,
		...restItems.map((r) => ({ start: ms(r.block.started_at), end: ms(r.block.ended_at) })),
		...skippedItems.map((s) => ({ start: ms(s.block.started_at), end: ms(s.block.ended_at) })),
	].sort((a, b) => a.start - b.start);

	// Merge overlaps so two parallel-ish entries don't fabricate a negative gap.
	const merged: { start: number; end: number }[] = [];
	for (const c of consuming) {
		const last = merged[merged.length - 1];
		if (last && c.start <= last.end) last.end = Math.max(last.end, c.end);
		else merged.push({ ...c });
	}

	const gaps: PlanGapItem[] = [];
	if (merged.length > 0) {
		for (let i = 1; i < merged.length; i++) {
			const seconds = (merged[i].start - merged[i - 1].end) / 1000;
			if (seconds > GAP_THRESHOLD_SECONDS) {
				gaps.push({
					kind: 'gap',
					from: new Date(merged[i - 1].end).toISOString(),
					to: new Date(merged[i].start).toISOString(),
					seconds,
				});
			}
		}
		// Trailing gap up to now.
		const tail = (nowMs - merged[merged.length - 1].end) / 1000;
		if (tail > GAP_THRESHOLD_SECONDS) {
			gaps.push({
				kind: 'gap',
				from: new Date(merged[merged.length - 1].end).toISOString(),
				to: new Date(nowMs).toISOString(),
				seconds: tail,
			});
		}
	}

	// ── 4. Assemble ──
	const pastSortKey = (item: PlanTimelineItem): number => {
		switch (item.kind) {
			case 'actual':
				return ms(item.startedAt);
			case 'rest':
			case 'skipped':
				return ms(item.block.started_at);
			case 'gap':
				return ms(item.from);
			default:
				return 0;
		}
	};

	const past: PlanTimelineItem[] = [...actuals, ...restItems, ...skippedItems, ...gaps].sort(
		(a, b) => pastSortKey(a) - pastSortKey(b)
	);

	future.sort((a, b) => ms(a.block.started_at) - ms(b.block.started_at));

	const items: PlanTimelineItem[] = [];
	if (past.length > 0) {
		items.push({ kind: 'heading', section: 'past' });
		items.push(...past);
	}
	items.push({ kind: 'now', ms: nowMs });
	if (future.length > 0) {
		items.push({ kind: 'heading', section: 'future' });
		items.push(...future);
	}

	// ── 5. Totals ──
	const doneSeconds = actuals.reduce((s, a) => s + a.seconds, 0);
	const unplannedSeconds = actuals.filter((a) => a.unplanned).reduce((s, a) => s + a.seconds, 0);

	return {
		items,
		totals: {
			doneSeconds,
			onPlanSeconds: doneSeconds - unplannedSeconds,
			offScheduleSeconds: actuals
				.filter((a) => a.offScheduleBlock !== null)
				.reduce((s, a) => s + a.seconds, 0),
			unplannedSeconds,
			remainingPlannedSeconds: future
				.filter((f) => f.block.task_id !== null)
				.reduce((s, f) => s + f.remainingSeconds, 0),
			// A break worked through is not a shortfall, and neither is a task simply moved to
			// another hour — only genuinely-untouched task time counts as skipped.
			skippedSeconds: skippedItems
				.filter((s) => !s.workedThrough && !s.movedElsewhere)
				.reduce((acc, s) => acc + s.seconds, 0),
			restSeconds: restItems.reduce((s, r) => s + r.seconds, 0),
			gapSeconds: gaps.reduce((s, g) => s + g.seconds, 0),
		},
	};
}
