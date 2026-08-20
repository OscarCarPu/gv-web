import { describe, it, expect } from 'vitest';
import {
	addDaysToDateInput,
	chipInk,
	eventTime,
	eventWhen,
	isoToDateInput,
	isoToLocalInput,
	localInputToISO,
} from '$lib/domains/calendar/utils/datetime';
import { toISOString } from '$lib/shared/utils/datetime';

// The suite runs with TZ=Europe/Madrid (see package.json), so these assert real offsets.

describe('calendar datetime helpers', () => {
	it('sends a wall-clock time as the instant it actually is', () => {
		// 17:00 in Madrid in August is 15:00Z. This is the whole reason the calendar does not
		// reuse the shared toISOString.
		expect(localInputToISO('2026-08-20T17:00')).toBe('2026-08-20T15:00:00.000Z');
		expect(localInputToISO('2026-01-20T17:00')).toBe('2026-01-20T16:00:00.000Z');
	});

	it('differs from the shared toISOString, which is for conceptual dates', () => {
		// The shared helper deliberately keeps the clock face and moves the zone — right for a
		// task due date, an hour or two wrong for an appointment.
		expect(toISOString('2026-08-20T17:00')).toBe('2026-08-20T17:00:00.000Z');
		expect(localInputToISO('2026-08-20T17:00')).not.toBe(toISOString('2026-08-20T17:00'));
	});

	it('round-trips an instant through the local input format', () => {
		expect(isoToLocalInput('2026-08-20T15:00:00Z')).toBe('2026-08-20T17:00');
		expect(localInputToISO(isoToLocalInput('2026-08-20T15:00:00Z'))).toBe(
			'2026-08-20T15:00:00.000Z'
		);
		expect(isoToDateInput('2026-08-20T22:00:00Z')).toBe('2026-08-21');
	});

	it('walks dates by calendar days, not by 24 hours', () => {
		expect(addDaysToDateInput('2026-08-20', 1)).toBe('2026-08-21');
		expect(addDaysToDateInput('2026-08-21', -1)).toBe('2026-08-20');
		// The night Spain moves to summer time is 23 hours long; a day step has to survive it.
		expect(addDaysToDateInput('2026-03-28', 1)).toBe('2026-03-29');
		expect(addDaysToDateInput('2026-03-29', 1)).toBe('2026-03-30');
		expect(addDaysToDateInput('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('labels a time range and an all-day span the way the API means them', () => {
		expect(eventTime('2026-08-20T15:00:00Z')).toBe('17:00');
		expect(eventWhen('2026-08-20T15:00:00Z', '2026-08-20T16:00:00Z', false)).toBe('17:00 – 18:00');
		// A single all-day event: the API's end is the next day, exclusive.
		expect(eventWhen('', '', true, '2026-08-20', '2026-08-21')).toBe('All day');
		// A calendar that reports UTC stores the same day at a different instant; the label must
		// not change with it.
		expect(
			eventWhen('2026-08-02T00:00:00Z', '2026-08-03T00:00:00Z', true, '2026-08-02', '2026-08-03')
		).toBe('All day');
		// Without dates it falls back to the instants.
		expect(eventWhen('2026-08-19T22:00:00Z', '2026-08-20T22:00:00Z', true)).toBe('All day');
		// Three days covered: the label stops at the last one, not at the exclusive end.
		expect(eventWhen('', '', true, '2026-08-20', '2026-08-23')).toBe('All day, Aug 20 – Aug 22');
	});
	describe('chip ink', () => {
		it('writes light text on a dark colour and dark text on a light one', () => {
			expect(chipInk('#3b82f6')).toBe('#ffffff'); // blue
			expect(chipInk('#10b981')).toBe('#ffffff'); // emerald
			expect(chipInk('#a855f7')).toBe('#ffffff'); // purple
			// Google's pale cyan, the colour that started all this, and the two brightest
			// palette entries.
			expect(chipInk('#9fe1e7')).toBe('#111827');
			expect(chipInk('#eab308')).toBe('#111827');
			expect(chipInk('#84cc16')).toBe('#111827');
		});

		it('falls back to light text for anything it cannot read', () => {
			expect(chipInk('')).toBe('#ffffff');
			expect(chipInk('blue')).toBe('#ffffff');
			expect(chipInk('#fff')).toBe('#ffffff');
		});
	});
});
