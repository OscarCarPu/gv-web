// Controller for the print-file drop zone: lists what is on the printer, uploads dropped
// files and starts/deletes prints. Same shape as PrinterController in ./printerStatus.svelte.ts.

import { SvelteSet } from 'svelte/reactivity';
import { addToast } from '$shared/stores/toast.svelte';
import {
	ActiveUploadsSchema,
	PrinterFilesSchema,
	UploadProgressSchema,
	type PrinterFile,
	type PrinterStorage,
} from './api/printers.schemas';

/**
 * Mirrors ALLOWED_EXTENSIONS in $lib/server/domotics/printers/files.ts so a bad drop fails instantly.
 * `.bgc` / `.gco` are the FAT32 8.3 short forms the printer itself uses; kept in step with the
 * server list so the two cannot drift.
 */
const ACCEPTED_EXTENSIONS = ['.bgcode', '.gcode', '.bgc', '.gco', '.g'];

export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

export function hasAcceptedExtension(name: string): boolean {
	const lower = name.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Explains an upload failure. The app's own errors arrive as JSON and are used verbatim, but a
 * big upload can also be killed by infrastructure *between* the browser and the app — those
 * reply with an HTML error page, so the status code is all we have to go on. Left unexplained
 * they surface as a bare "Upload failed (524)", which tells nobody anything.
 */
export function uploadErrorMessage(status: number, serverError = ''): string {
	if (serverError) return serverError;

	switch (status) {
		case 0:
			return 'Connection lost during the upload. Check the network and try again.';
		case 401:
		case 403:
			return 'Your session expired. Reload the page and sign in again.';
		case 413:
			return 'File too large for the server. Raise BODY_SIZE_LIMIT.';
		case 502:
		case 503:
			return 'The server was unreachable during the upload. It may be restarting.';
		case 504:
		case 524:
			// The server now answers as soon as it has the bytes and forwards to the printer in the
			// background, so this should no longer happen for a slow printer — if it does, the
			// browser → server transfer itself is what ran past the ~100s tunnel limit.
			return 'The connection was cut off after ~100s while sending the file to the server. Try again, or upload from the local network to bypass the tunnel.';
		default:
			return `Upload failed (${status}).`;
	}
}

/**
 * Files above this are sent as a series of PATCH chunks instead of one PUT. The Cloudflare tunnel
 * in front of the app rejects request bodies over 100 MB (Free/Pro), and the failure is an opaque
 * dropped connection; chunks keep every request far below that. Also sized so one chunk finishes
 * well inside the tunnel's ~100s per-request limit on a slow home uplink.
 */
export const CHUNK_SIZE = 25 * 1024 * 1024;
const CHUNK_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FileSortKey = 'name' | 'date' | 'size';
export type SortDir = 'asc' | 'desc';

/** Direction a key starts in when first picked: newest and biggest first, names A→Z. */
export const DEFAULT_DIR: Record<FileSortKey, SortDir> = {
	name: 'asc',
	date: 'desc',
	size: 'desc',
};

/**
 * Filters by a case-insensitive substring of the display name, then sorts. Files missing the
 * sort value (no size / no date reported) always sink to the bottom, whatever the direction.
 * Ties fall back to the name so the order is stable between polls.
 */
export function arrangeFiles(
	files: PrinterFile[],
	query: string,
	key: FileSortKey,
	dir: SortDir
): PrinterFile[] {
	const q = query.trim().toLowerCase();
	const byName = (a: PrinterFile, b: PrinterFile) =>
		a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' });
	const sign = dir === 'asc' ? 1 : -1;
	const valueOf = (f: PrinterFile) => (key === 'size' ? f.size : f.modifiedAt);

	return files
		.filter((f) => !q || f.displayName.toLowerCase().includes(q))
		.sort((a, b) => {
			if (key === 'name') return sign * byName(a, b);
			const va = valueOf(a);
			const vb = valueOf(b);
			if (va == null || vb == null) {
				if (va != null) return -1;
				if (vb != null) return 1;
				return byName(a, b);
			}
			return va === vb ? byName(a, b) : sign * (va - vb);
		});
}

export type UploadStatus = 'uploading' | 'sending' | 'done' | 'error' | 'conflict';

export type Upload = {
	id: number;
	/** Server-side id, used to poll progress and to recognise an upload after a reload. */
	serverId: string;
	name: string;
	size: number;
	/** Bytes the browser has sent to gv-web. */
	sent: number;
	/** Bytes gv-web has forwarded to the printer — polled, since XHR cannot see this leg. */
	forwarded: number;
	status: UploadStatus;
	/** Seconds left on the printer leg, from a smoothed forwarding rate. Absent until measurable. */
	etaSeconds?: number;
	error?: string;
	/**
	 * Kept so a 409 can be replayed with ?overwrite=1. Absent for a row adopted from the server
	 * after a reload — the browser no longer holds the bytes, so Replace/Retry cannot work.
	 */
	file?: File;
};

let nextUploadId = 0;

export class PrinterFilesController {
	readonly id: string;

	files = $state<PrinterFile[]>([]);
	storage = $state<PrinterStorage | null>(null);
	online = $state(true);
	error = $state<string | null>(null);
	loading = $state(true);
	uploads = $state<Upload[]>([]);
	/** Name of the file a print/delete is currently in flight for. */
	busy = $state<string | null>(null);
	/** Files marked for a bulk delete, by name. */
	selected = new SvelteSet<string>();
	/** True while a bulk delete is running. */
	deleting = $state(false);

	query = $state('');
	sortKey = $state<FileSortKey>('date');
	sortDir = $state<SortDir>(DEFAULT_DIR.date);
	/** The list as shown: searched and sorted. */
	shown = $derived(arrangeFiles(this.files, this.query, this.sortKey, this.sortDir));

	// Deliberately outside $state: a native XHR must not be wrapped in a reactive proxy.
	private xhrs = new Map<number, XMLHttpRequest>();
	/** Uploads the user cancelled, so a chunked loop stops instead of retrying the aborted chunk. */
	private cancelled = new Set<number>();
	/** Progress pollers, keyed by server-side upload id. */
	private watchers = new Map<string, ReturnType<typeof setInterval>>();

	constructor(id: string) {
		this.id = id;
	}

	private get base(): string {
		return `/domotics/printers/${this.id}/files`;
	}

	async refresh(): Promise<void> {
		try {
			const res = await fetch(this.base, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = PrinterFilesSchema.parse(await res.json());
			this.files = data.files;
			// Forget marks on files that are gone, so the count never includes ghosts.
			for (const name of this.selected) {
				if (!data.files.some((f) => f.name === name)) this.selected.delete(name);
			}
			this.storage = data.storage ?? null;
			this.online = data.online;
			this.error = data.error ?? null;
		} catch (e) {
			this.online = false;
			this.error = e instanceof Error ? e.message : 'Could not list files';
		} finally {
			this.loading = false;
		}
	}

	/** True when the printer will accept an upload right now. */
	get canUpload(): boolean {
		return this.online && this.storage?.available !== false && this.storage?.readOnly !== true;
	}

	/** Why uploads are unavailable, or null when they are fine. */
	get blockedReason(): string | null {
		if (!this.online) {
			return this.error ? `PrusaLink unreachable: ${this.error}` : 'PrusaLink unreachable';
		}
		if (this.storage?.available === false) return 'No USB drive detected in the printer';
		if (this.storage?.readOnly === true) return 'The printer storage is read-only';
		return null;
	}

	/** Queues one upload per accepted entry; rejects the rest with a toast. */
	addFiles(list: FileList | File[]): void {
		for (const file of Array.from(list)) {
			if (!hasAcceptedExtension(file.name)) {
				addToast(`${file.name} is not a printable file`, 'error');
				continue;
			}
			if (file.size === 0) {
				addToast(`${file.name} is empty`, 'error');
				continue;
			}
			void this.upload(file);
		}
	}

	/**
	 * Adopts uploads the server is still forwarding that this page did not start — after a reload,
	 * or after navigating away and back. Without it those transfers keep running invisibly and the
	 * row simply vanishes.
	 */
	async adoptActiveUploads(): Promise<void> {
		try {
			const res = await fetch(`${this.base}/progress`, { headers: { Accept: 'application/json' } });
			if (!res.ok) return;
			const { uploads } = ActiveUploadsSchema.parse(await res.json());

			for (const u of uploads) {
				if (u.status !== 'forwarding') continue; // settled ones have nothing left to show
				if (this.uploads.some((e) => e.serverId === u.uploadId)) continue;

				this.uploads = [
					...this.uploads,
					{
						id: nextUploadId++,
						serverId: u.uploadId,
						name: u.name,
						size: u.total,
						sent: u.total, // the browser leg is necessarily finished
						forwarded: u.sent,
						status: 'sending',
					},
				];
				this.watch(this.uploads[this.uploads.length - 1]);
			}
		} catch {
			// Not critical — the page just will not show pre-existing uploads.
		}
	}

	/**
	 * Polls the server for an upload's forwarding progress and its final outcome. The PUT only
	 * returns 202, so this is where success, failure and a 409 name conflict actually surface.
	 */
	private watch(entry: Upload, onSettled?: () => void): void {
		if (this.watchers.has(entry.serverId)) return;

		let missing = 0;

		// Time left comes from an exponentially smoothed rate: the printer writes in bursts, so a
		// single tick's rate swings by an order of magnitude and would make the countdown jitter.
		let lastAt = Date.now();
		let lastBytes = entry.forwarded;
		let rate = 0; // bytes per second

		const settle = () => {
			const t = this.watchers.get(entry.serverId);
			if (t) clearInterval(t);
			this.watchers.delete(entry.serverId);
			onSettled?.();
		};
		const fail = (message: string, status: UploadStatus = 'error') => {
			entry.status = status;
			entry.error = message;
			settle();
		};
		const succeed = () => {
			entry.forwarded = entry.size;
			entry.status = 'done';
			addToast(`${entry.name} uploaded`);
			void this.refresh();
			// Drop the finished row once the file itself has appeared in the list.
			setTimeout(() => this.dismiss(entry.id), 1500);
			settle();
		};

		const timer = setInterval(async () => {
			try {
				const res = await fetch(`${this.base}/progress?u=${encodeURIComponent(entry.serverId)}`, {
					headers: { Accept: 'application/json' },
				});
				if (!res.ok) return;
				const p = UploadProgressSchema.parse(await res.json());

				if (p.sent > entry.forwarded) entry.forwarded = p.sent;

				if (p.sent > lastBytes) {
					const now = Date.now();
					const elapsed = (now - lastAt) / 1000;
					if (elapsed > 0) {
						const sample = (p.sent - lastBytes) / elapsed;
						rate = rate ? rate * 0.7 + sample * 0.3 : sample;
						entry.etaSeconds = Math.max(0, entry.size - p.sent) / rate;
					}
					lastAt = now;
					lastBytes = p.sent;
				}

				if (p.status === 'done') return succeed();
				if (p.status === 'error') {
					return fail(
						p.error ?? 'The printer rejected the upload',
						p.httpStatus === 409 ? 'conflict' : 'error'
					);
				}
				if (p.status === 'unknown') {
					// A server restart loses in-flight state; don't hang the row forever.
					if (++missing >= 5) {
						fail('Lost track of this upload. Check the file list to see if it arrived.');
					}
					return;
				}
				missing = 0;
			} catch {
				// Transient failure — the next tick will retry.
			}
		}, 500);

		this.watchers.set(entry.serverId, timer);
	}

	/**
	 * Uploads via XMLHttpRequest rather than fetch — upload.onprogress is the only way to get
	 * progress in a browser, and it covers only the browser → gv-web leg. The server then replies
	 * 202 and forwards to the printer, so watch() reports the rest.
	 */
	upload(file: File, overwrite = false): Promise<void> {
		const id = nextUploadId++;
		const uploadId = crypto.randomUUID();
		this.uploads = [
			...this.uploads,
			{
				id,
				serverId: uploadId,
				name: file.name,
				size: file.size,
				sent: 0,
				forwarded: 0,
				status: 'uploading',
				file,
			},
		];

		// Read the entry back out of the reactive array: mutating the object literal above would
		// not notify, only its $state proxy does.
		const entry = this.uploads[this.uploads.length - 1];

		if (file.size > CHUNK_SIZE) return this.uploadChunked(file, entry, id, uploadId, overwrite);

		return new Promise<void>((resolve) => {
			const xhr = new XMLHttpRequest();
			this.xhrs.set(id, xhr);

			const finish = () => {
				this.xhrs.delete(id);
				resolve();
			};
			const fail = (message: string, status: UploadStatus = 'error') => {
				entry.status = status;
				entry.error = message;
				finish();
			};
			const startPolling = () => this.watch(entry, finish);

			const url = overwrite ? `${this.base}?overwrite=1` : this.base;
			xhr.open('PUT', url);
			xhr.setRequestHeader('Accept', 'application/json');
			xhr.setRequestHeader('Content-Type', 'application/octet-stream');
			// A custom header forces a CORS preflight, which is what keeps this endpoint safe from
			// cross-origin posts (SvelteKit's CSRF check ignores octet-stream bodies).
			xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
			// Lets /files/progress report how far the server has got forwarding to the printer.
			xhr.setRequestHeader('X-Upload-Id', uploadId);

			xhr.upload.onprogress = (e) => {
				if (!e.lengthComputable) return;
				entry.sent = e.loaded;
				if (e.loaded >= e.total) {
					entry.status = 'sending';
					startPolling();
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					// 202: gv-web has the bytes but the printer does not yet. Keep the row alive and
					// let the poller report the real outcome.
					entry.sent = entry.size;
					entry.status = 'sending';
					startPolling();
					return;
				}

				let serverError = '';
				try {
					const parsed = JSON.parse(xhr.responseText);
					if (parsed?.error) serverError = parsed.error;
				} catch {
					// Not our JSON — a gateway error page, so uploadErrorMessage explains it instead.
				}
				const message = uploadErrorMessage(xhr.status, serverError);
				fail(message, xhr.status === 409 ? 'conflict' : 'error');
			};

			xhr.onerror = () => fail('Network error while uploading');
			xhr.onabort = () => fail('Upload cancelled');
			xhr.ontimeout = () => fail('Upload timed out');

			xhr.send(file);
		});
	}

	/**
	 * Sends one chunk as a PATCH. Resolves with the HTTP status (0 for a network failure, -1 for an
	 * abort) and the parsed JSON body, if any — never rejects, so the caller owns the retry policy.
	 */
	private sendChunk(
		id: number,
		file: File,
		uploadId: string,
		offset: number,
		overwrite: boolean,
		onProgress: (loaded: number) => void
	): Promise<{ status: number; body: Record<string, unknown> | null }> {
		const end = Math.min(offset + CHUNK_SIZE, file.size);
		return new Promise((resolve) => {
			const xhr = new XMLHttpRequest();
			this.xhrs.set(id, xhr);
			const done = (status: number) => {
				this.xhrs.delete(id);
				let body: Record<string, unknown> | null = null;
				try {
					body = JSON.parse(xhr.responseText);
				} catch {
					// Not our JSON — a gateway error page; the status alone is explained upstream.
				}
				resolve({ status, body });
			};

			xhr.open('PATCH', overwrite ? `${this.base}?overwrite=1` : this.base);
			xhr.setRequestHeader('Accept', 'application/json');
			xhr.setRequestHeader('Content-Type', 'application/octet-stream');
			xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
			xhr.setRequestHeader('X-Upload-Id', uploadId);
			xhr.setRequestHeader('X-Upload-Offset', String(offset));
			xhr.setRequestHeader('X-Upload-Total', String(file.size));

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) onProgress(e.loaded);
			};
			xhr.onload = () => done(xhr.status);
			xhr.onerror = () => done(0);
			xhr.onabort = () => done(-1);
			xhr.send(file.slice(offset, end));
		});
	}

	/**
	 * Large-file path: PATCH the file in CHUNK_SIZE pieces, in order. A transient failure retries
	 * the same chunk (the server treats a repeated offset as already received), and a 409 carries
	 * the byte count the server really has, so the loop resumes from there. The last chunk is
	 * answered with 202 and from then on this behaves exactly like the single-PUT path.
	 */
	private uploadChunked(
		file: File,
		entry: Upload,
		id: number,
		uploadId: string,
		overwrite: boolean
	): Promise<void> {
		return new Promise<void>((resolve) => {
			const finish = () => {
				this.xhrs.delete(id);
				this.cancelled.delete(id);
				resolve();
			};
			const fail = (message: string) => {
				entry.status = 'error';
				entry.error = message;
				finish();
			};

			void (async () => {
				let offset = 0;
				let retries = 0;

				while (offset < file.size) {
					const res = await this.sendChunk(id, file, uploadId, offset, overwrite, (loaded) => {
						entry.sent = Math.min(offset + loaded, file.size);
					});

					if (this.cancelled.has(id) || res.status === -1) return fail('Upload cancelled');

					if (res.status >= 200 && res.status < 300) {
						retries = 0;
						if (res.status === 202) {
							entry.sent = entry.size;
							entry.status = 'sending';
							this.watch(entry, finish);
							return;
						}
						const received = res.body?.received;
						offset = typeof received === 'number' ? received : offset + CHUNK_SIZE;
						entry.sent = Math.min(offset, file.size);
						continue;
					}

					const received = res.body?.received;
					if (res.status === 409 && typeof received === 'number' && retries < CHUNK_RETRIES) {
						retries++;
						offset = received;
						continue;
					}

					const transient = res.status === 0 || res.status >= 500;
					if (transient && retries < CHUNK_RETRIES) {
						retries++;
						await sleep(1000 * retries);
						continue;
					}

					const serverError = typeof res.body?.error === 'string' ? res.body.error : '';
					return fail(uploadErrorMessage(res.status, serverError));
				}
			})();
		});
	}

	/** Replays a conflicted upload with Overwrite: ?1. Needs the original bytes. */
	replace(entry: Upload): void {
		const file = entry.file;
		if (!file) return;
		this.dismiss(entry.id);
		void this.upload(file, true);
	}

	retry(entry: Upload): void {
		const file = entry.file;
		if (!file) return;
		this.dismiss(entry.id);
		void this.upload(file);
	}

	cancel(entry: Upload): void {
		this.cancelled.add(entry.id);
		this.xhrs.get(entry.id)?.abort();
	}

	dismiss(uploadId: number): void {
		this.uploads = this.uploads.filter((u) => u.id !== uploadId);
	}

	async print(name: string): Promise<void> {
		this.busy = name;
		try {
			const res = await fetch(`${this.base}?name=${encodeURIComponent(name)}`, {
				method: 'POST',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			addToast(`Printing ${name}`);
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not start the print', 'error');
		} finally {
			this.busy = null;
		}
	}

	async remove(name: string): Promise<void> {
		this.busy = name;
		try {
			const res = await fetch(`${this.base}?name=${encodeURIComponent(name)}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			addToast(`${name} deleted`);
			await this.refresh();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not delete the file', 'error');
		} finally {
			this.busy = null;
		}
	}

	/** Picking the active key flips its direction; a new key starts in its natural direction. */
	sortBy(key: FileSortKey): void {
		if (this.sortKey === key) {
			this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		this.sortKey = key;
		this.sortDir = DEFAULT_DIR[key];
	}

	/**
	 * What "select all" acts on: the files the search currently shows, minus read-only ones
	 * (which cannot be deleted anyway). So search + select all marks exactly the matches.
	 */
	get deletable(): PrinterFile[] {
		return this.shown.filter((f) => f.readOnly !== true);
	}

	get allSelected(): boolean {
		const deletable = this.deletable;
		return deletable.length > 0 && deletable.every((f) => this.selected.has(f.name));
	}

	toggle(name: string): void {
		if (this.selected.has(name)) this.selected.delete(name);
		else this.selected.add(name);
	}

	toggleAll(): void {
		if (this.allSelected) {
			for (const f of this.deletable) this.selected.delete(f.name);
			return;
		}
		for (const f of this.deletable) this.selected.add(f.name);
	}

	/**
	 * Deletes every marked file. One DELETE at a time: PrusaLink is a small embedded server and
	 * the USB drive is FAT32, so parallel requests buy nothing but failures. Keeps going past a
	 * failure (e.g. the file currently printing) and leaves the failed ones marked.
	 */
	async removeSelected(): Promise<void> {
		const names = [...this.selected];
		if (names.length === 0 || this.deleting) return;
		this.deleting = true;

		let removed = 0;
		let firstError: string | null = null;
		try {
			for (const name of names) {
				this.busy = name;
				try {
					const res = await fetch(`${this.base}?name=${encodeURIComponent(name)}`, {
						method: 'DELETE',
						headers: { Accept: 'application/json' },
					});
					const body = await res.json().catch(() => null);
					if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
					this.selected.delete(name);
					removed++;
				} catch (e) {
					firstError ??= `${name}: ${e instanceof Error ? e.message : 'could not delete'}`;
				}
			}
		} finally {
			this.busy = null;
			this.deleting = false;
		}

		const failed = names.length - removed;
		if (removed > 0) addToast(`${removed} file${removed === 1 ? '' : 's'} deleted`);
		if (failed > 0) {
			addToast(`${failed} could not be deleted. ${firstError ?? ''}`.trim(), 'error');
		}
		await this.refresh();
	}

	start(): void {
		void this.refresh();
		void this.adoptActiveUploads();
	}

	/**
	 * Only tears down this page's timers. In-flight uploads are deliberately left running: the
	 * server keeps forwarding to the printer regardless, and aborting the XHR here would cancel a
	 * transfer just because the user navigated away. A returning page re-attaches via
	 * adoptActiveUploads().
	 */
	stop(): void {
		for (const t of this.watchers.values()) clearInterval(t);
		this.watchers.clear();
	}
}
