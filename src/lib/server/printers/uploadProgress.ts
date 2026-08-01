// Tracks how far the gv-web → printer leg of an upload has got, so the browser can show a
// percentage for it. That leg happens entirely server-side and is invisible to XHR progress,
// which only covers browser → gv-web.
//
// Deliberately in-memory: a single container serves this app, uploads are short-lived, and
// losing progress on restart just means the bar sits at "Sending to printer…" as it did before.

type Entry = { sent: number; total: number; updatedAt: number };

const entries = new Map<string, Entry>();

const TTL_MS = 5 * 60_000;
/** Bounds the map if a client ever sends ids without finishing the uploads. */
const MAX_ENTRIES = 32;

/** Upload ids come from the client, so keep them to a harmless shape and length. */
export function sanitizeUploadId(raw: string | null): string | null {
	if (!raw) return null;
	return /^[A-Za-z0-9-]{8,64}$/.test(raw) ? raw : null;
}

function sweep(now: number): void {
	for (const [id, e] of entries) {
		if (now - e.updatedAt > TTL_MS) entries.delete(id);
	}
	while (entries.size > MAX_ENTRIES) {
		const oldest = [...entries.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
		if (!oldest) break;
		entries.delete(oldest[0]);
	}
}

export function startUpload(id: string, total: number): void {
	const now = Date.now();
	sweep(now);
	entries.set(id, { sent: 0, total, updatedAt: now });
}

export function setUploadProgress(id: string, sent: number): void {
	const e = entries.get(id);
	if (!e) return;
	e.sent = sent;
	e.updatedAt = Date.now();
}

export function getUploadProgress(id: string): { sent: number; total: number } | null {
	const e = entries.get(id);
	return e ? { sent: e.sent, total: e.total } : null;
}

export function endUpload(id: string): void {
	entries.delete(id);
}
