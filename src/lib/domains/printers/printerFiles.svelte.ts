// Controller for the print-file drop zone: lists what is on the printer, uploads dropped
// files and starts/deletes prints. Same shape as PrinterController in ./printerStatus.svelte.ts.

import { addToast } from '$shared/stores/toast.svelte';
import { PrinterFilesSchema, type PrinterFile, type PrinterStorage } from './api/printers.schemas';

/** Mirrors ALLOWED_EXTENSIONS in $lib/server/printers/files.ts so a bad drop fails instantly. */
export const ACCEPTED_EXTENSIONS = ['.bgcode', '.gcode', '.gco', '.g'];

export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

export function hasAcceptedExtension(name: string): boolean {
	const lower = name.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type UploadStatus = 'uploading' | 'sending' | 'done' | 'error' | 'conflict';

export type Upload = {
	id: number;
	name: string;
	size: number;
	sent: number;
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
			{ id, name: file.name, size: file.size, sent: 0, status: 'uploading', file },
		];

		// Read the entry back out of the reactive array: mutating the object literal above would
		// not notify, only its $state proxy does.
		const entry = this.uploads[this.uploads.length - 1];

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

			const url = overwrite ? `${this.base}?overwrite=1` : this.base;
			xhr.open('PUT', url);
			xhr.setRequestHeader('Accept', 'application/json');
			xhr.setRequestHeader('Content-Type', 'application/octet-stream');
			// A custom header forces a CORS preflight, which is what keeps this endpoint safe from
			// cross-origin posts (SvelteKit's CSRF check ignores octet-stream bodies).
			xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));

			xhr.upload.onprogress = (e) => {
				if (!e.lengthComputable) return;
				entry.sent = e.loaded;
				if (e.loaded >= e.total) entry.status = 'sending';
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					entry.sent = entry.size;
					entry.status = 'done';
					addToast(`${file.name} uploaded`);
					void this.refresh();
					// Drop the finished row once the file itself has appeared in the list.
					setTimeout(() => this.dismiss(id), 1500);
					finish();
					return;
				}

				let message = `Upload failed (${xhr.status})`;
				try {
					const parsed = JSON.parse(xhr.responseText);
					if (parsed?.error) message = parsed.error;
				} catch {
					// Non-JSON body (e.g. a 413 straight from the proxy) — keep the generic message.
				}
				if (xhr.status === 413) {
					message = 'File too large for the server (raise BODY_SIZE_LIMIT)';
				}
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
