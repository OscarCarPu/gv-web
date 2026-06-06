import { isoDate, inclusiveMonthStart, yearStart } from '../utils/statsDate';
import type { StatsGranularity } from '../types/Money.types';

export type StatsRange = '3m' | '6m' | '1y' | 'ytd' | 'all';

export interface RangeOption {
	value: StatsRange;
	label: string;
}

/** The fixed `3M / 6M / 1Y / YTD / All` toggle options, shared by all sheets. */
export const STATS_RANGES: RangeOption[] = [
	{ value: '3m', label: '3M' },
	{ value: '6m', label: '6M' },
	{ value: '1y', label: '1Y' },
	{ value: 'ytd', label: 'YTD' },
	{ value: 'all', label: 'All' },
];

/** How many inclusive months each fixed range spans (ytd/all are special-cased). */
const RANGE_MONTHS: Record<Exclude<StatsRange, 'ytd' | 'all'>, number> = {
	'3m': 3,
	'6m': 6,
	'1y': 12,
};

/**
 * Owns the `3M / 6M / 1Y / YTD / All` range machinery shared by NetWorthSheet and
 * MonthlyTrendSheet. `range` is reactive state read directly by the template; the
 * computed boundaries are exposed as getters so they recompute on access.
 *
 * The inclusive-month rule (CLAUDE.md): `3M` from any day in April means the first
 * day of `month − 2` (Feb 1), `YTD` means Jan 1, and `All` omits `from` so the
 * backend defaults to the earliest transaction date.
 *
 * `granularity` follows the NetWorth rule (`3m`/`6m` → `week`, else `month`); sheets
 * that don't need granularity simply ignore the getter.
 */
export class RangeSelector {
	range = $state<StatsRange>('6m');

	/** The toggle options (static label list), exposed for template `{#each}`. */
	readonly ranges: RangeOption[] = STATS_RANGES;

	constructor(initial: StatsRange = '6m') {
		this.range = initial;
	}

	setRange(value: StatsRange): void {
		this.range = value;
	}

	/** Start date for the current range, or `undefined` for 'all' (omit `from`). */
	get fromDate(): Date | undefined {
		if (this.range === 'all') return undefined;
		if (this.range === 'ytd') return yearStart();
		return inclusiveMonthStart(RANGE_MONTHS[this.range]);
	}

	/** Start date as local `YYYY-MM-DD`, or `undefined` for 'all'. */
	get from(): string | undefined {
		const d = this.fromDate;
		return d ? isoDate(d) : undefined;
	}

	/** NetWorth granularity: `3m`/`6m` → `week`, `1y`/`ytd`/`all` → `month`. */
	get granularity(): StatsGranularity {
		return this.range === '3m' || this.range === '6m' ? 'week' : 'month';
	}
}
