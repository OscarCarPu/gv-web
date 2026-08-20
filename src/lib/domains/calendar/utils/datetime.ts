/**
 * Calendar times are real instants, not conceptual dates.
 *
 * `$shared/utils/datetime`'s `toISOString` deliberately shifts a local wall time so it lands on
 * the same clock face in UTC — right for a task's `due_at`, which is a day rather than a moment.
 * An event at 17:00 in Madrid is 15:00Z, and sending 17:00Z would move every event by the
 * offset. Hence a separate pair of helpers here, and no reuse of that one.
 */
export function localInputToISO(local: string): string {
	return new Date(local).toISOString();
}

/** Local `YYYY-MM-DDTHH:MM` for a `datetime-local`-style input, from an instant. */
export function isoToLocalInput(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local `YYYY-MM-DD` for a date input, from an instant. */
export function isoToDateInput(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysToDateInput(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00`);
	d.setDate(d.getDate() + days);
	return isoToDateInput(d.toISOString());
}

const timeFormatter = new Intl.DateTimeFormat('en', {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** `HH:MM` in the viewer's zone. */
export function eventTime(iso: string): string {
	return timeFormatter.format(new Date(iso));
}

/**
 * The label for an event's when: a time range, or the day span for an all-day event. The end of
 * an all-day event is exclusive in the API, so the last day shown is one before it — the same
 * convention Google's UI uses.
 */
export function eventWhen(startsAt: string, endsAt: string, allDay: boolean): string {
	if (!allDay) return `${eventTime(startsAt)} – ${eventTime(endsAt)}`;
	const start = new Date(startsAt);
	const lastDay = new Date(new Date(endsAt).getTime() - 86_400_000);
	const fmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });
	if (fmt.format(start) === fmt.format(lastDay)) return 'All day';
	return `All day, ${fmt.format(start)} – ${fmt.format(lastDay)}`;
}
