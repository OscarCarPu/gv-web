import { formatMoney } from '$lib/shared/utils/money';
import type { Overview } from '../types/Money.types';

/** The monthly-balance / savings / vs-prev-month KPI tile values for the OverviewCard. */
export interface OverviewKpis {
	balanceNum: number;
	balancePrefix: string;
	balanceAbs: string;
	savingsRate: number;
	balanceChangePct: number;
	hasPrevBalance: boolean;
}

/**
 * Derive the OverviewCard KPI tile values from a money `Overview`. Monetary fields are
 * `NUMERIC` strings, so they are `parseFloat`-ed here at format time. Pure — no reactive
 * state. Mirrors the documented money rules:
 *   - `savingsRate`     = `balance / income * 100` (0 when income ≤ 0)
 *   - `balanceChangePct`= `(balance − prev.balance) / |prev.balance| * 100`
 *   - `hasPrevBalance`  = prev.balance ≠ 0 ("—" tile when false)
 */
export function deriveOverviewKpis(overview: Overview): OverviewKpis {
	const balanceNum = parseFloat(overview.month.balance);
	const balancePrefix = balanceNum > 0 ? '+' : balanceNum < 0 ? '−' : '';
	const balanceAbs = formatMoney(Math.abs(balanceNum).toFixed(2));

	const incomeNum = parseFloat(overview.month.income);
	const savingsRate = incomeNum > 0 ? (balanceNum / incomeNum) * 100 : 0;

	const prevBalanceNum = parseFloat(overview.previous_month.balance);
	const balanceChangePct =
		prevBalanceNum !== 0 ? ((balanceNum - prevBalanceNum) / Math.abs(prevBalanceNum)) * 100 : 0;
	const hasPrevBalance = prevBalanceNum !== 0;

	return {
		balanceNum,
		balancePrefix,
		balanceAbs,
		savingsRate,
		balanceChangePct,
		hasPrevBalance,
	};
}
