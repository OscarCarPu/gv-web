import { describe, it, expect } from 'vitest';
import {
	toLocalDateString,
	toLocalDatetime,
	toISOString,
	formatTime,
	isoToHHmm,
	formatElapsed,
	isoToLocalInput,
} from '$shared/utils/datetime';

describe('toLocalDateString', () => {
	it('should return YYYY-MM-DD for today when called without args', () => {
		const result = toLocalDateString();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		const now = new Date();
		expect(result).toBe(
			`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
		);
	});

	it('should return the local date, not UTC date', () => {
		// 2026-03-15T23:30 UTC = 2026-03-16 in UTC, but still 2026-03-15 in UTC-5
		const date = new Date('2026-03-16T04:30:00Z'); // UTC
		const result = toLocalDateString(date);
		// Should match the local date of the test environment, not necessarily UTC
		const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		expect(result).toBe(expected);
	});

	it('should pad single-digit month and day', () => {
		const date = new Date(2026, 0, 5); // Jan 5
		expect(toLocalDateString(date)).toBe('2026-01-05');
	});

	it('should handle year boundaries', () => {
		const date = new Date(2025, 11, 31); // Dec 31
		expect(toLocalDateString(date)).toBe('2025-12-31');
	});
});

describe('toLocalDatetime', () => {
	it('should return empty string for null', () => {
		expect(toLocalDatetime(null)).toBe('');
	});

	it('should return empty string for empty string', () => {
		expect(toLocalDatetime('')).toBe('');
	});

	it('should extract YYYY-MM-DDTHH:MM from full ISO string', () => {
		expect(toLocalDatetime('2026-04-06T14:30:00.000Z')).toBe('2026-04-06T14:30');
	});

	it('should extract YYYY-MM-DDTHH:MM from ISO string without milliseconds', () => {
		expect(toLocalDatetime('2026-04-06T14:30:00Z')).toBe('2026-04-06T14:30');
	});

	it('should preserve midnight', () => {
		expect(toLocalDatetime('2026-04-06T00:00:00.000Z')).toBe('2026-04-06T00:00');
	});

	it('should preserve end-of-day times', () => {
		expect(toLocalDatetime('2026-04-06T23:59:00.000Z')).toBe('2026-04-06T23:59');
	});
});

describe('toISOString', () => {
	it('should return null for empty string', () => {
		expect(toISOString('')).toBeNull();
	});

	it('should preserve the local date in the UTC output', () => {
		const result = toISOString('2026-04-06T14:30');
		expect(result).toMatch(/^2026-04-06T14:30:00\.000Z$/);
	});

	it('should preserve midnight without shifting the date', () => {
		const result = toISOString('2026-04-06T00:00');
		expect(result).toMatch(/^2026-04-06T00:00:00\.000Z$/);
	});

	it('should preserve end-of-day times', () => {
		const result = toISOString('2026-04-06T23:59');
		expect(result).toMatch(/^2026-04-06T23:59:00\.000Z$/);
	});

	it('should handle date-only input', () => {
		const result = toISOString('2026-04-06');
		expect(result).toContain('2026-04-06T');
	});
});

describe('toISOString and toLocalDatetime roundtrip', () => {
	it('should roundtrip a datetime-local value', () => {
		const local = '2026-04-06T14:30';
		const iso = toISOString(local)!;
		const back = toLocalDatetime(iso);
		expect(back).toBe(local);
	});

	it('should roundtrip midnight', () => {
		const local = '2026-04-06T00:00';
		const iso = toISOString(local)!;
		const back = toLocalDatetime(iso);
		expect(back).toBe(local);
	});

	it('should roundtrip end-of-day', () => {
		const local = '2026-04-06T23:59';
		const iso = toISOString(local)!;
		const back = toLocalDatetime(iso);
		expect(back).toBe(local);
	});
});

describe('formatTime', () => {
	it('should format hours only', () => {
		expect(formatTime(3600)).toBe('1h');
	});

	it('should format hours and minutes', () => {
		expect(formatTime(5400)).toBe('1h 30m');
	});

	it('should format zero', () => {
		expect(formatTime(0)).toBe('0h');
	});

	it('should format multiple hours', () => {
		expect(formatTime(9000)).toBe('2h 30m');
	});
});

describe('isoToHHmm', () => {
	it('formats an ISO string as zero-padded local HH:MM', () => {
		expect(isoToHHmm(new Date(2026, 6, 15, 9, 5).toISOString())).toBe('09:05');
		expect(isoToHHmm(new Date(2026, 6, 15, 23, 59).toISOString())).toBe('23:59');
		expect(isoToHHmm(new Date(2026, 6, 15, 0, 0).toISOString())).toBe('00:00');
	});

	it('accepts epoch milliseconds', () => {
		expect(isoToHHmm(new Date(2026, 6, 15, 14, 30).getTime())).toBe('14:30');
	});

	it('accepts a Date', () => {
		expect(isoToHHmm(new Date(2026, 6, 15, 7, 8))).toBe('07:08');
	});

	it('agrees across all three input forms for the same instant', () => {
		const d = new Date(2026, 6, 15, 16, 42);
		expect(isoToHHmm(d)).toBe(isoToHHmm(d.getTime()));
		expect(isoToHHmm(d)).toBe(isoToHHmm(d.toISOString()));
	});
});

describe('formatElapsed', () => {
	it('formats as zero-padded HH:MM:SS', () => {
		expect(formatElapsed(0)).toBe('00:00:00');
		expect(formatElapsed(59)).toBe('00:00:59');
		expect(formatElapsed(60)).toBe('00:01:00');
		expect(formatElapsed(3661)).toBe('01:01:01');
	});

	it('does not wrap past 24 hours', () => {
		expect(formatElapsed(90000)).toBe('25:00:00');
	});

	it('truncates fractional seconds instead of printing decimals', () => {
		expect(formatElapsed(61.9)).toBe('00:01:01');
	});
});

describe('isoToLocalInput', () => {
	it('produces a datetime-local value in local time', () => {
		expect(isoToLocalInput(new Date(2026, 6, 15, 9, 5).toISOString())).toBe('2026-07-15T09:05');
	});

	it('zero-pads month, day, hour and minute', () => {
		expect(isoToLocalInput(new Date(2026, 0, 2, 3, 4).toISOString())).toBe('2026-01-02T03:04');
	});

	it('returns an empty string for null', () => {
		expect(isoToLocalInput(null)).toBe('');
	});

	it('round-trips through the datetime-local input value', () => {
		const original = new Date(2026, 6, 15, 13, 37);
		const roundTripped = new Date(isoToLocalInput(original.toISOString()));
		expect(roundTripped.getTime()).toBe(original.getTime());
	});
});
