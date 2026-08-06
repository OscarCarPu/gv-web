// Formatting shared by the printer panels.

/** Human byte size, one unit step at a time: `812 KB`, `4.1 MB`, `1.20 GB`. */
export function formatBytes(bytes?: number): string {
	if (bytes == null) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const mb = bytes / (1024 * 1024);
	if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;
	return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Elapsed time as a video clock: `04:31`, `1:12:05`. Deliberately not formatElapsed() from
 * $shared/utils/datetime — that always pads the hour segment, and `00:00:09` under a nine-second
 * thumbnail reads as noise where `00:09` reads as a duration.
 */
export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
