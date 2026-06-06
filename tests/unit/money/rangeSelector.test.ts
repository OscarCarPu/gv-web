import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('RangeSelector', () => {
	let RangeSelector: typeof import('$lib/domains/money/stats/rangeSelector.svelte').RangeSelector;

	beforeEach(async () => {
		vi.useFakeTimers();
		// Mid-month reference: 15 Apr 2026.
		vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0));
		RangeSelector = (await import('$lib/domains/money/stats/rangeSelector.svelte')).RangeSelector;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('defaults to the 6m range', () => {
		expect(new RangeSelector().range).toBe('6m');
	});

	it('3M → first day of month − 2 (inclusive boundary)', () => {
		const s = new RangeSelector('3m');
		expect(s.from).toBe('2026-02-01');
		expect(s.granularity).toBe('week');
	});

	it('6m → Nov 1 of previous year, weekly granularity', () => {
		const s = new RangeSelector('6m');
		expect(s.from).toBe('2025-11-01');
		expect(s.granularity).toBe('week');
	});

	it('1y → May 1 of previous year, monthly granularity', () => {
		const s = new RangeSelector('1y');
		expect(s.from).toBe('2025-05-01');
		expect(s.granularity).toBe('month');
	});

	it('ytd → Jan 1 of current year, monthly granularity', () => {
		const s = new RangeSelector('ytd');
		expect(s.from).toBe('2026-01-01');
		expect(s.granularity).toBe('month');
	});

	it('all → undefined from (omit so backend uses earliest tx date)', () => {
		const s = new RangeSelector('all');
		expect(s.from).toBeUndefined();
		expect(s.fromDate).toBeUndefined();
		expect(s.granularity).toBe('month');
	});

	it('setRange updates the computed start date', () => {
		const s = new RangeSelector('6m');
		s.setRange('3m');
		expect(s.range).toBe('3m');
		expect(s.from).toBe('2026-02-01');
	});
});
