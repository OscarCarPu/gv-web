import { toLocalDateString } from '$lib/shared/utils/datetime';
import type { TaskByDueDateResponse } from '$lib/domains/tasks/types/Task.types';

export type DueSoonTier = 'overdue' | 'today' | 'week' | 'later';

export interface DueSoonGroup {
	tier: DueSoonTier;
	label: string;
	tasks: TaskByDueDateResponse[];
}

const TIER_LABELS: Record<DueSoonTier, string> = {
	overdue: 'Overdue',
	today: 'Start Today',
	week: 'This Week',
	later: 'Later',
};

const WEEK_HORIZON_DAYS = 7;

function actualDate(t: TaskByDueDateResponse): string | null {
	const d = t.due_at ?? t.project_due_at;
	return d ? d.slice(0, 10) : null;
}

/** start_by when the task has one (it carries an estimate), else its actual date. */
function effectiveDate(t: TaskByDueDateResponse): string | null {
	return t.start_by ?? actualDate(t);
}

function addDays(dateStr: string, days: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + days);
	return toLocalDateString(d);
}

function tierFor(t: TaskByDueDateResponse, today: string, weekEdge: string): DueSoonTier {
	const actual = actualDate(t);
	if (actual !== null && actual < today) return 'overdue';
	if (t.urgent) return 'today';
	const effective = effectiveDate(t);
	if (effective !== null && effective <= weekEdge) return 'week';
	return 'later';
}

/** Missing dates sort last within a tier without dropping the task. */
const NO_DATE_SORT_KEY = '9999-99-99';

function compareByDateThenPriority(
	a: TaskByDueDateResponse,
	b: TaskByDueDateResponse,
	dateFn: (t: TaskByDueDateResponse) => string | null
): number {
	const da = dateFn(a) ?? NO_DATE_SORT_KEY;
	const db = dateFn(b) ?? NO_DATE_SORT_KEY;
	if (da !== db) return da < db ? -1 : 1;
	return a.priority - b.priority;
}

/**
 * Splits Due Soon into four tiers so urgency changes a task's *position*, not just its color.
 * `overdue` / `today` sort by the real due date (what's actually closest); `week` / `later` sort
 * by the effective date — `start_by` when the task carries an estimate, otherwise its due date —
 * so an un-estimated task behaves exactly as before and never lands in `today` by accident.
 */
export function groupTasksByUrgency(
	tasks: TaskByDueDateResponse[],
	today: string = toLocalDateString()
): DueSoonGroup[] {
	const weekEdge = addDays(today, WEEK_HORIZON_DAYS);
	const buckets: Record<DueSoonTier, TaskByDueDateResponse[]> = {
		overdue: [],
		today: [],
		week: [],
		later: [],
	};

	for (const t of tasks) {
		buckets[tierFor(t, today, weekEdge)].push(t);
	}

	buckets.overdue.sort((a, b) => compareByDateThenPriority(a, b, actualDate));
	buckets.today.sort((a, b) => compareByDateThenPriority(a, b, actualDate));
	buckets.week.sort((a, b) => compareByDateThenPriority(a, b, effectiveDate));
	buckets.later.sort((a, b) => compareByDateThenPriority(a, b, effectiveDate));

	return (['overdue', 'today', 'week', 'later'] as DueSoonTier[]).map((tier) => ({
		tier,
		label: TIER_LABELS[tier],
		tasks: buckets[tier],
	}));
}

/** Truncates a tier-ordered group list to a total task budget, dropping emptied tiers. */
export function truncateDueSoonGroups(groups: DueSoonGroup[], limit: number): DueSoonGroup[] {
	const result: DueSoonGroup[] = [];
	let remaining = limit;
	for (const g of groups) {
		if (remaining <= 0) break;
		if (g.tasks.length === 0) continue;
		result.push({ ...g, tasks: g.tasks.slice(0, remaining) });
		remaining -= Math.min(g.tasks.length, remaining);
	}
	return result;
}

function formatHoursShort(hours: number): string {
	return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function daysBetween(fromStr: string, toStr: string): number {
	const from = new Date(`${fromStr}T00:00:00`).getTime();
	const to = new Date(`${toStr}T00:00:00`).getTime();
	return Math.round((to - from) / 86_400_000);
}

/**
 * One-line explanation for why an urgent task is urgent — "6h left · should've started 2d ago" —
 * shown instead of relying on color alone. Returns null when there's nothing to say (no estimate,
 * or not urgent), leaving the existing badges as the only signal.
 */
export function buildUrgencyPhrase(
	t: TaskByDueDateResponse,
	today: string = toLocalDateString()
): string | null {
	if (!t.urgent || t.remaining_hours == null || t.start_by == null) return null;
	const hours = parseFloat(t.remaining_hours);
	if (!Number.isFinite(hours)) return null;

	const hoursLabel = `${formatHoursShort(hours)} left`;
	if (t.start_by >= today) return `${hoursLabel} · start today`;

	const daysLate = daysBetween(t.start_by, today);
	const startLabel =
		daysLate === 1 ? "should've started yesterday" : `should've started ${daysLate}d ago`;
	return `${hoursLabel} · ${startLabel}`;
}
