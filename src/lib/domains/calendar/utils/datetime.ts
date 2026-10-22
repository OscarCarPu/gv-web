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

const timeFormatter = new Intl.DateTimeFormat('en', {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** `HH:MM` in the viewer's zone. */
export function eventTime(iso: string): string {
	return timeFormatter.format(new Date(iso));
}
