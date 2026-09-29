/** `YYYY-MM` month helpers for the budgets page. Pure — no reactive state. */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isBudgetMonth(value: string | null | undefined): value is string {
	return value != null && MONTH_RE.test(value);
}

/** The local current month as `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** `ym` moved by `delta` months. */
export function shiftMonth(ym: string, delta: number): string {
	const [y, m] = ym.split('-').map(Number);
	return currentMonth(new Date(y, m - 1 + delta, 1));
}

/** `2026-09` → `September 2026` (or `Sep 2026` when `short`). */
export function formatMonth(ym: string, short = false): string {
	const [y, m] = ym.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
		month: short ? 'short' : 'long',
		year: 'numeric',
	});
}
