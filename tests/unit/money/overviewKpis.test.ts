import { describe, it, expect } from 'vitest';
import { deriveOverviewKpis } from '$lib/domains/money/utils/money';
import type { Overview } from '$lib/domains/money/types/Money.types';

function overview(over: {
	income?: string;
	expense?: string;
	balance?: string;
	prevBalance?: string;
}): Overview {
	return {
		accounts_total: '0.00',
		month: {
			income: over.income ?? '0.00',
			expense: over.expense ?? '0.00',
			balance: over.balance ?? '0.00',
		},
		previous_month: {
			income: '0.00',
			expense: '0.00',
			balance: over.prevBalance ?? '0.00',
		},
		recent_transactions: [],
	};
}

describe('deriveOverviewKpis', () => {
	describe('savingsRate', () => {
		it('is balance / income * 100', () => {
			const kpis = deriveOverviewKpis(overview({ income: '1000.00', balance: '250.00' }));
			expect(kpis.savingsRate).toBeCloseTo(25);
		});

		it('is 0 when income is 0 (avoids divide-by-zero)', () => {
			const kpis = deriveOverviewKpis(overview({ income: '0.00', balance: '250.00' }));
			expect(kpis.savingsRate).toBe(0);
		});

		it('can be negative when the balance is negative', () => {
			const kpis = deriveOverviewKpis(overview({ income: '1000.00', balance: '-100.00' }));
			expect(kpis.savingsRate).toBeCloseTo(-10);
		});
	});

	describe('balance prefix / abs', () => {
		it('uses + for a positive balance', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '50.00' }));
			expect(kpis.balanceNum).toBe(50);
			expect(kpis.balancePrefix).toBe('+');
		});

		it('uses − for a negative balance', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '-50.00' }));
			expect(kpis.balancePrefix).toBe('−');
		});

		it('uses no prefix for a zero balance', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '0.00' }));
			expect(kpis.balancePrefix).toBe('');
		});
	});

	describe('balanceChangePct vs prev month', () => {
		it('is (balance − prev) / |prev| * 100', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '150.00', prevBalance: '100.00' }));
			expect(kpis.hasPrevBalance).toBe(true);
			expect(kpis.balanceChangePct).toBeCloseTo(50);
		});

		it('uses the absolute prev balance as the denominator', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '50.00', prevBalance: '-100.00' }));
			// (50 − (−100)) / |−100| * 100 = 150
			expect(kpis.balanceChangePct).toBeCloseTo(150);
		});

		it('marks hasPrevBalance false when prev balance is 0 ("—" tile)', () => {
			const kpis = deriveOverviewKpis(overview({ balance: '50.00', prevBalance: '0.00' }));
			expect(kpis.hasPrevBalance).toBe(false);
			expect(kpis.balanceChangePct).toBe(0);
		});
	});
});
