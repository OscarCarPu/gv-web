import { describe, it, expect } from 'vitest';
import { CalendarEventListSchema } from '$lib/domains/calendar/api/calendar.schemas';

describe('calendar schemas', () => {
	it('parses what the API returns', () => {
		const events = CalendarEventListSchema.parse([
			{
				id: 1,
				name: 'Dentist',
				start_time: '2026-08-20T09:00:00Z',
				end_time: '2026-08-20T10:00:00Z',
			},
		]);
		expect(events[0].name).toBe('Dentist');
	});

	it('rejects an event without a time range', () => {
		expect(() => CalendarEventListSchema.parse([{ id: 1, name: 'x' }])).toThrow();
	});
});
