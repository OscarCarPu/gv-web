import { formatTime } from '$lib/shared/utils/datetime';

/**
 * A day's free time as `5h 30m` (or `5h` on the hour). The API sends hours as a decimal string
 * (`"5.5"`); rounding that to whole hours, as the strip once did, turned a 5h 30m day into "6h"
 * and a 20-minute one into "0h" — the very difference that decides whether a task still fits.
 * Unreadable or negative input reads as no free time rather than as a broken label.
 */
export function formatFreeHours(hours: string): string {
	const h = parseFloat(hours);
	const seconds = Number.isFinite(h) && h > 0 ? Math.round(h * 60) * 60 : 0;
	return formatTime(seconds);
}
