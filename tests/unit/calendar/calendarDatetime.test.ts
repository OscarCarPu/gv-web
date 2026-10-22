import { describe, it, expect } from 'vitest';
import { eventTime, isoToLocalInput, localInputToISO } from '$lib/domains/calendar/utils/datetime';
import { toISOString } from '$lib/shared/utils/datetime';

// The suite runs with TZ=Europe/Madrid (see package.json), so these assert real offsets.

describe('calendar datetime helpers', () => {
	it('sends a wall-clock time as the instant it actually is', () => {
		// 17:00 in Madrid in August is 15:00Z. This is why the calendar does not reuse the
		// shared toISOString.
		expect(localInputToISO('2026-08-20T17:00')).toBe('2026-08-20T15:00:00.000Z');
		expect(localInputToISO('2026-01-20T17:00')).toBe('2026-01-20T16:00:00.000Z');
		expect(localInputToISO('2026-08-20T17:00')).not.toBe(toISOString('2026-08-20T17:00'));
	});

	it('round-trips an instant through the local input format', () => {
		expect(isoToLocalInput('2026-08-20T15:00:00Z')).toBe('2026-08-20T17:00');
		expect(localInputToISO(isoToLocalInput('2026-08-20T15:00:00Z'))).toBe(
			'2026-08-20T15:00:00.000Z'
		);
	});

	it('shows the time in the viewer zone', () => {
		expect(eventTime('2026-08-20T15:00:00Z')).toBe('17:00');
	});
});
