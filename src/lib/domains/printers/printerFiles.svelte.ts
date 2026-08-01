// Controller for the print-file drop zone: lists what is on the printer, uploads dropped
// files and starts/deletes prints. Same shape as PrinterController in ./printerStatus.svelte.ts.

import { addToast } from '$shared/stores/toast.svelte';
import {
	PrinterFilesSchema,
	UploadProgressSchema,
	type PrinterFile,
	type PrinterStorage,
} from './api/printers.schemas';

/** Mirrors ALLOWED_EXTENSIONS in $lib/server/printers/files.ts so a bad drop fails instantly. */
export const ACCEPTED_EXTENSIONS = ['.bgcode', '.gcode', '.gco', '.g'];

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

export type UploadStatus = 'uploading' | 'sending' | 'done' | 'error' | 'conflict';

export type Upload = {
	id: number;
	name: string;
	size: number;
	/** Bytes the browser has sent to gv-web. */
	sent: number;
	/** Bytes gv-web has forwarded to the printer — polled, since XHR cannot see this leg. */
	forwarded: number;
	status: UploadStatus;
	error?: string;
	/** Kept so a 409 can be replayed with ?overwrite=1. */
	file: File;
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

	// Deliberately outside $state: a native XHR must not be wrapped in a reactive proxy.
	private xhrs = new Map<number, XMLHttpRequest>();

	constructor(id: string) {
		this.id = id;
	}

	private get base(): string {
		return `/printers/${this.id}/files`;
	}

	async refresh(): Promise<void> {
		try {
			const res = await fetch(this.base, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = PrinterFilesSchema.parse(await res.json());
			this.files = data.files;
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
	 * Uploads via XMLHttpRequest rather than fetch — upload.onprogress is the only way to get
	 * progress in a browser. The progress covers browser → gv-web only; the gv-web → printer
	 * leg is invisible, which is what the 'sending' status covers.
	 */
	upload(file: File, overwrite = false): Promise<void> {
		const id = nextUploadId++;
		this.uploads = [
			...this.uploads,
			{ id, name: file.name, size: file.size, sent: 0, forwarded: 0, status: 'uploading', file },
		];

		// Read the entry back out of the reactive array: mutating the object literal above would
		// not notify, only its $state proxy does.
		const entry = this.uploads[this.uploads.length - 1];
		const uploadId = crypto.randomUUID();

		return new Promise<void>((resolve) => {
			const xhr = new XMLHttpRequest();
			this.xhrs.set(id, xhr);

			let poll: ReturnType<typeof setInterval> | null = null;
			const stopPolling = () => {
				if (poll) clearInterval(poll);
				poll = null;
			};

			const finish = () => {
				stopPolling();
				this.xhrs.delete(id);
				resolve();
			};
			const fail = (message: string, status: UploadStatus = 'error') => {
				entry.status = status;
				entry.error = message;
				finish();
			};
			const succeed = () => {
				entry.forwarded = entry.size;
				entry.status = 'done';
				addToast(`${file.name} uploaded`);
				void this.refresh();
				// Drop the finished row once the file itself has appeared in the list.
				setTimeout(() => this.dismiss(id), 1500);
				finish();
			};

			// The server accepts the bytes and forwards to the printer in the background, so the
			// real outcome arrives here rather than in the upload response.
			let missing = 0;
			const startPolling = () => {
				if (poll) return;
				poll = setInterval(async () => {
					try {
						const res = await fetch(`${this.base}/progress?u=${encodeURIComponent(uploadId)}`, {
							headers: { Accept: 'application/json' },
						});
						if (!res.ok) return;
						const p = UploadProgressSchema.parse(await res.json());

						if (p.sent > entry.forwarded) entry.forwarded = p.sent;

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
			};

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

	/** Replays a conflicted upload with Overwrite: ?1. */
	replace(entry: Upload): void {
		const file = entry.file;
		this.dismiss(entry.id);
		void this.upload(file, true);
	}

	retry(entry: Upload): void {
		const file = entry.file;
		this.dismiss(entry.id);
		void this.upload(file);
	}

	cancel(entry: Upload): void {
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

	start(): void {
		void this.refresh();
	}

	stop(): void {
		for (const xhr of this.xhrs.values()) xhr.abort();
		this.xhrs.clear();
	}
}
