import { describe, it, expect } from 'vitest';
import { toLocalDatetime, toISOString, formatTime } from '$shared/utils/datetime';

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
