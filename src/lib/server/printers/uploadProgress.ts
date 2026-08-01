// Tracks an upload's gv-web → printer leg so the browser can both show a percentage for it and
// pick up its outcome.
//
// This exists because that leg is slow and invisible: the request that delivers the file must
// return as soon as the bytes have arrived, otherwise the whole printer transfer happens inside
// one HTTP request and the Cloudflare tunnel kills it at ~100s with a 524. So the route forwards
// in the background and the browser polls here for progress and the final result.
//
// Deliberately in-memory: a single container serves this app and uploads are short-lived. A
// restart mid-forward loses the entry, which the client reports as losing track of the upload.

export type UploadStatus = 'forwarding' | 'done' | 'error';

export type UploadState = {
	sent: number;
	total: number;
	status: UploadStatus;
	/** Human-readable reason, when status is 'error'. */
	error?: string;
	/** Upstream status code, so the client can treat 409 as a name conflict. */
	httpStatus?: number;
};

/** An upload plus the identity a reloaded page needs to recognise and re-attach to it. */
export type ActiveUpload = UploadState & { uploadId: string; name: string };

type Entry = UploadState & { printerId: string; name: string; updatedAt: number };

const entries = new Map<string, Entry>();

/** In-flight uploads can legitimately take a while; finished ones only need to be collected. */
const FORWARDING_TTL_MS = 30 * 60_000;
const SETTLED_TTL_MS = 2 * 60_000;
/** Bounds the map if a client ever abandons uploads. */
const MAX_ENTRIES = 32;

/** Upload ids come from the client, so keep them to a harmless shape and length. */
export function sanitizeUploadId(raw: string | null): string | null {
	if (!raw) return null;
	return /^[A-Za-z0-9-]{8,64}$/.test(raw) ? raw : null;
}

function sweep(now: number): void {
	for (const [id, e] of entries) {
		const ttl = e.status === 'forwarding' ? FORWARDING_TTL_MS : SETTLED_TTL_MS;
		if (now - e.updatedAt > ttl) entries.delete(id);
	}
	while (entries.size > MAX_ENTRIES) {
		const oldest = [...entries.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
		if (!oldest) break;
		entries.delete(oldest[0]);
	}
}

export function startUpload(id: string, printerId: string, name: string, total: number): void {
	const now = Date.now();
	sweep(now);
	entries.set(id, { sent: 0, total, status: 'forwarding', printerId, name, updatedAt: now });
}

/**
 * Every upload this server still knows about for a printer, newest last. Lets a page that was
 * reloaded or navigated away from re-attach to an upload it did not start, instead of silently
 * losing track of a transfer that is still running.
 */
export function listUploads(printerId: string): ActiveUpload[] {
	sweep(Date.now());
	return [...entries.entries()]
		.filter(([, e]) => e.printerId === printerId)
		.sort((a, b) => a[1].updatedAt - b[1].updatedAt)
		.map(([uploadId, e]) => ({
			uploadId,
			name: e.name,
			sent: e.sent,
			total: e.total,
			status: e.status,
			error: e.error,
			httpStatus: e.httpStatus,
		}));
}

export function setUploadProgress(id: string, sent: number): void {
	const e = entries.get(id);
	if (!e || e.status !== 'forwarding') return;
	e.sent = sent;
	e.updatedAt = Date.now();
}

/** Records the outcome. The entry is kept briefly so the browser can still read it. */
export function finishUpload(
	id: string,
	result: { ok: boolean; error?: string; httpStatus?: number }
): void {
	const e = entries.get(id);
	if (!e) return;
	e.status = result.ok ? 'done' : 'error';
	if (result.ok) e.sent = e.total;
	e.error = result.error;
	e.httpStatus = result.httpStatus;
	e.updatedAt = Date.now();
}

export function getUploadProgress(id: string): UploadState | null {
	const e = entries.get(id);
	if (!e) return null;
	return {
		sent: e.sent,
		total: e.total,
		status: e.status,
		error: e.error,
		httpStatus: e.httpStatus,
	};
}
