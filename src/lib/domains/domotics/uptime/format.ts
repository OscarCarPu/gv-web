/** Formatting for the Uptime tab. Kept out of the controller so it can be unit-tested. */

/** "98.92%", or a dash when there is nothing to divide. */
export function formatPercent(value: number | null | undefined): string {
	if (value === null || value === undefined) return '—';
	return `${value.toFixed(2)}%`;
}

/**
 * Coarse duration: the largest two units that matter. Used for "up for 7d 4h" and for the
 * length of an outage, where seconds are noise.
 */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);

	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	if (minutes > 0) return `${minutes}m`;
	return `${total}s`;
}

/** "3 days ago" / "in 2 minutes" / "just now". */
export function formatAgo(iso: string | null, now: number = Date.now()): string {
	if (!iso) return 'never';
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return 'unknown';
	const diff = now - then;
	if (Math.abs(diff) < 60_000) return 'just now';
	const duration = formatDuration(Math.abs(diff) / 1000);
	return diff > 0 ? `${duration} ago` : `in ${duration}`;
}

/** "13 Aug, 16:54" — enough to place an event without a full timestamp. */
export function formatMoment(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
}
