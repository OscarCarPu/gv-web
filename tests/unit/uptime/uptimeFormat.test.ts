import { describe, it, expect } from 'vitest';
import {
	formatAgo,
	formatDuration,
	formatMoment,
	formatPercent,
} from '$lib/domains/domotics/uptime/format';

describe('formatPercent', () => {
	it('keeps the two decimals the pipeline computes', () => {
		expect(formatPercent(98.9)).toBe('98.90%');
		expect(formatPercent(100)).toBe('100.00%');
	});

	it('shows a dash when there is nothing to divide', () => {
		// null is the API's answer for a range no window overlaps — not zero uptime.
		expect(formatPercent(null)).toBe('—');
		expect(formatPercent(undefined)).toBe('—');
	});
});

describe('formatDuration', () => {
	it('keeps the two largest units that matter', () => {
		expect(formatDuration(45)).toBe('45s');
		expect(formatDuration(90)).toBe('1m');
		expect(formatDuration(3600)).toBe('1h');
		expect(formatDuration(3600 + 25 * 60)).toBe('1h 25m');
		expect(formatDuration(7 * 86400 + 4 * 3600)).toBe('7d 4h');
		expect(formatDuration(2 * 86400)).toBe('2d');
	});

	it('never renders a negative length', () => {
		expect(formatDuration(-10)).toBe('0s');
	});
});

describe('formatAgo', () => {
	const now = new Date('2026-08-20T12:00:00Z').getTime();

	it('describes the distance from now', () => {
		expect(formatAgo('2026-08-20T11:00:00Z', now)).toBe('1h ago');
		expect(formatAgo('2026-08-13T08:00:00Z', now)).toBe('7d 4h ago');
	});

	it('collapses the last minute', () => {
		expect(formatAgo('2026-08-20T11:59:30Z', now)).toBe('just now');
	});

	it('handles a computed_at in the future rather than showing a negative age', () => {
		// Clock skew between the pipeline host and the browser is enough to produce this.
		expect(formatAgo('2026-08-20T13:00:00Z', now)).toBe('in 1h');
	});

	it('says so when there is no timestamp at all', () => {
		expect(formatAgo(null, now)).toBe('never');
		expect(formatAgo('not-a-date', now)).toBe('unknown');
	});
});

describe('formatMoment', () => {
	it('formats in the local zone, not UTC', () => {
		// Tests run in Europe/Madrid, so 16:54Z is 18:54 local. Whether that renders as
		// "18:54" or "06:54 PM" depends on the runtime's locale, not on this code — the CI
		// image defaults to en-US where the dev machines are es-ES — so assert the instant
		// rather than one locale's spelling of it.
		const rendered = formatMoment('2026-08-13T16:54:25Z');
		expect(rendered).toMatch(/(18:54|6:54)/);
		expect(rendered).not.toMatch(/16:54|4:54/);
	});

	it('passes an unparseable value through untouched', () => {
		expect(formatMoment('whenever')).toBe('whenever');
	});
});
