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

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const HHMM_OR_MIDNIGHT_RE = /^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/;

export function isValidHHmm(s: string, allowMidnight = false): boolean {
	return (allowMidnight ? HHMM_OR_MIDNIGHT_RE : HHMM_RE).test(s);
}

/** Converts "HH:MM" (00:00–24:00) into an ISO string anchored to today. 24:00 rolls to next-day 00:00. */
export function hhmmToISO(hhmm: string): string {
	const d = new Date();
	const [h, m] = hhmm.split(':').map(Number);
	if (h === 24 && m === 0) {
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() + 1);
	} else {
		d.setHours(h, m, 0, 0);
	}
	return d.toISOString();
}

export function isoToHHmm(iso: string): string {
	const d = new Date(iso);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const shortFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const fullFormatter = new Intl.DateTimeFormat('es', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
});
const weekdayFormatter = new Intl.DateTimeFormat('es', { weekday: 'long' });

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
	if (!iso) return 'Sin fecha';
	const hit = dueDayCache.get(iso);
	if (hit !== undefined) return hit;
	const d = new Date(iso);
	const weekday = weekdayFormatter.format(d);
	const out = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d.getDate()}/${d.getMonth() + 1}`;
	if (dueDayCache.size >= FORMAT_CACHE_LIMIT) dueDayCache.clear();
	dueDayCache.set(iso, out);
	return out;
}
