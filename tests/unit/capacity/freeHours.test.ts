import { describe, it, expect } from 'vitest';
import { formatFreeHours } from '$lib/domains/capacity/utils/freeHours';

describe('formatFreeHours', () => {
	it('shows whole hours without minutes', () => {
		expect(formatFreeHours('14')).toBe('14h');
		expect(formatFreeHours('6.00')).toBe('6h');
	});

	it('shows the minutes a rounded hour would hide', () => {
		expect(formatFreeHours('5.5')).toBe('5h 30m');
		expect(formatFreeHours('2.25')).toBe('2h 15m');
		expect(formatFreeHours('0.33')).toBe('0h 20m');
	});

	it('does not round up into the next hour', () => {
		// 5h 29m 59s rounds to the nearest minute, not to 6h.
		expect(formatFreeHours('5.4999')).toBe('5h 30m');
		expect(formatFreeHours('5.999')).toBe('6h');
	});

	it('reads no capacity, negative or unreadable values as zero', () => {
		expect(formatFreeHours('0')).toBe('0h');
		expect(formatFreeHours('-2')).toBe('0h');
		expect(formatFreeHours('abc')).toBe('0h');
		expect(formatFreeHours('')).toBe('0h');
	});
});
