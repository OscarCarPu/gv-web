import { toISOString, toLocalDateString } from '$lib/shared/utils/datetime';

/**
 * ISO datetime `recurrence` days from today, anchored at local noon — used to
 * reschedule a recurring task's `due_at` on renewal.
 */
export function buildRecurringDueAt(recurrence: number): string {
	const d = new Date();
	d.setDate(d.getDate() + recurrence);
	return toISOString(toLocalDateString(d) + 'T12:00')!;
}
