import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	pad,
	isoDate,
	monthKey,
	currentMonth,
	monthBounds,
	inclusiveMonthStart,
	yearStart,
} from '$lib/domains/money/utils/statsDate';

describe('statsDate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Mid-month reference: 15 Apr 2026 (month index 3).
		vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('pad', () => {
		it('zero-pads to two digits', () => {
			expect(pad(3)).toBe('03');
			expect(pad(12)).toBe('12');
		});
	});

	describe('isoDate', () => {
		it('formats a local date as YYYY-MM-DD without tz shift', () => {
			expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
			expect(isoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
		});
	});

	describe('monthKey / currentMonth', () => {
		it('monthKey formats YYYY-MM', () => {
			expect(monthKey(new Date(2026, 1, 9))).toBe('2026-02');
		});

		it('currentMonth uses the system clock', () => {
			expect(currentMonth()).toBe('2026-04');
		});
	});

	describe('monthBounds', () => {
		it('returns first and last day for a normal month', () => {
			expect(monthBounds('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
		});

		it('handles February in a non-leap year', () => {
			expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
		});

		it('handles February in a leap year', () => {
			expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
		});
	});

	describe('inclusiveMonthStart (the inclusive-month-boundary rule)', () => {
		it('3M from mid-April → first day of month − 2 (Feb 1)', () => {
			expect(isoDate(inclusiveMonthStart(3))).toBe('2026-02-01');
		});

		it('6M from mid-April → Nov 1 of the previous year', () => {
			expect(isoDate(inclusiveMonthStart(6))).toBe('2025-11-01');
		});

		it('12M (1Y) from mid-April → May 1 of the previous year', () => {
			expect(isoDate(inclusiveMonthStart(12))).toBe('2025-05-01');
		});

		it('honors an explicit reference date', () => {
			expect(isoDate(inclusiveMonthStart(3, new Date(2026, 0, 20)))).toBe('2025-11-01');
		});
	});

	describe('yearStart (YTD)', () => {
		it('returns Jan 1 of the current year', () => {
			expect(isoDate(yearStart())).toBe('2026-01-01');
		});

		it('honors an explicit reference date', () => {
			expect(isoDate(yearStart(new Date(2024, 5, 30)))).toBe('2024-01-01');
		});
	});
});
