/**
 * Pure date helpers shared by the money stats sheets (NetWorth, MonthlyTrend,
 * Estimation, CategoryBreakdown). All functions are side-effect free and operate
 * on local calendar dates — see the money "Stats sheets — shared patterns" rules
 * in CLAUDE.md for the inclusive-month-boundary semantics.
 */

/** Zero-pad a number to two digits ("3" → "03"). */
export function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/** Local `YYYY-MM-DD` for a date (no timezone shift). */
export function isoDate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local `YYYY-MM` for a date. */
export function monthKey(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Current month as `YYYY-MM`. */
export function currentMonth(): string {
	return monthKey(new Date());
}

/**
 * First and last day of a `YYYY-MM` month, as local `YYYY-MM-DD` strings.
 * e.g. `monthBounds('2026-02')` → `{ from: '2026-02-01', to: '2026-02-28' }`.
 */
export function monthBounds(ym: string): { from: string; to: string } {
	const [y, m] = ym.split('-').map(Number);
	const last = new Date(y, m, 0).getDate();
	const mm = pad(m);
	return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${pad(last)}` };
}

/**
 * Start date for an inclusive N-month window ending in the current month.
 * `3M` from Apr means the first day of `month − 2` (Feb 1), not 90 days ago.
 * Build the start date as `new Date(y, m - (N - 1), 1)`.
 */
export function inclusiveMonthStart(months: number, ref: Date = new Date()): Date {
	return new Date(ref.getFullYear(), ref.getMonth() - (months - 1), 1);
}

/** Jan 1 of the reference date's year (year-to-date start). */
export function yearStart(ref: Date = new Date()): Date {
	return new Date(ref.getFullYear(), 0, 1);
}
