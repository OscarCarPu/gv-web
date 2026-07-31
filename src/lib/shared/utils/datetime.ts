export function toLocalDateString(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function toLocalDatetime(iso: string | null): string {
	if (!iso) return '';
	return iso.slice(0, 16);
}

export function toISOString(local: string): string | null {
	if (!local) return null;
	const d = new Date(local);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

export function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Converts "HH:MM" into an ISO string anchored to today. If `endOfDay` and the value is "00:00", rolls to next-day 00:00. */
export function hhmmToISO(hhmm: string, endOfDay = false): string {
	const d = new Date();
	const [h, m] = hhmm.split(':').map(Number);
	d.setHours(h, m, 0, 0);
	if (endOfDay && h === 0 && m === 0) {
		d.setDate(d.getDate() + 1);
	}
	return d.toISOString();
}

/**
 * Local `HH:MM` for an ISO string, an epoch-ms number, or a Date. Single source of truth
 * for wall-clock labels (plan blocks, the now line, agenda rows, time entries).
 */
export function isoToHHmm(value: string | number | Date): string {
	const d = value instanceof Date ? value : new Date(value);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `HH:MM:SS` elapsed label for a duration in seconds (timer display). */
export function formatElapsed(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Local `YYYY-MM-DDTHH:MM` for a `datetime-local` input, from an ISO string. */
export function isoToLocalInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const shortFormatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });
const fullFormatter = new Intl.DateTimeFormat('en', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
});
const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'long' });

const shortCache = new Map<string, string>();
const fullCache = new Map<string, string>();
const dueDayCache = new Map<string, string>();
const FORMAT_CACHE_LIMIT = 500;

export function formatDateShort(dateStr: string): string {
	const hit = shortCache.get(dateStr);
	if (hit !== undefined) return hit;
	const out = shortFormatter.format(new Date(dateStr));
	if (shortCache.size >= FORMAT_CACHE_LIMIT) shortCache.clear();
	shortCache.set(dateStr, out);
	return out;
}

export function formatDateFull(iso: string): string {
	const hit = fullCache.get(iso);
	if (hit !== undefined) return hit;
	const out = fullFormatter.format(new Date(iso));
	if (fullCache.size >= FORMAT_CACHE_LIMIT) fullCache.clear();
	fullCache.set(iso, out);
	return out;
}

export function formatDueDay(iso: string | null): string {
	if (!iso) return 'No date';
	const hit = dueDayCache.get(iso);
	if (hit !== undefined) return hit;
	const d = new Date(iso);
	const weekday = weekdayFormatter.format(d);
	const out = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d.getDate()}/${d.getMonth() + 1}`;
	if (dueDayCache.size >= FORMAT_CACHE_LIMIT) dueDayCache.clear();
	dueDayCache.set(iso, out);
	return out;
}
