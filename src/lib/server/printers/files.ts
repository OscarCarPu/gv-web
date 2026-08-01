// Print-file management on a printer's local storage, over PrusaLink's v1 files API.
//
//   PUT    /api/v1/files/{storage}/{name}  — upload (raw binary body, not multipart)
//   POST   /api/v1/files/{storage}/{name}  — start printing it
//   DELETE /api/v1/files/{storage}/{name}  — remove it
//   GET    /api/v1/files/{storage}/        — list the folder
//   GET    /api/v1/storage                 — which storages exist and how full they are
//
// Auth and transport come from ./prusalink; this module owns path building, name validation
// and normalizing the payloads into the shape the UI consumes.

import type { Printer } from './config';
import { authSend } from './prusalink';

/** Extensions the printer can actually print. `.bgcode` is the Core One's native format. */
const ALLOWED_EXTENSIONS = ['.bgcode', '.gcode', '.gco', '.g'];
// FAT32 long-filename ceiling — the same validator also gates print/delete of files already
// on the drive, so it must not be stricter than what the printer itself accepts.
const MAX_NAME_LENGTH = 255;
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const UPLOAD_TIMEOUT_MS = 180_000;
const COMMAND_TIMEOUT_MS = 10_000;

export type PrinterFile = {
	name: string;
	displayName: string;
	size?: number;
	readOnly?: boolean;
};

export type PrinterStorage = {
	name: string;
	available: boolean;
	readOnly: boolean;
	freeSpace?: number;
	totalSpace?: number;
};

export type PrinterFiles = {
	online: boolean;
	storage?: PrinterStorage;
	files: PrinterFile[];
	error?: string;
};

/**
 * Reduces an untrusted client-supplied filename to a safe basename, or null if it is not
 * acceptable. This is the security boundary for the upload endpoint: the result is
 * interpolated into the upstream URL path, so directory traversal must not survive it.
 */
export function sanitizeFileName(raw: string): string | null {
	if (typeof raw !== 'string') return null;

	// Take the basename only — separators of either flavour, wherever they appear.
	const base = raw.split(/[/\\]/).pop()?.trim() ?? '';

	if (!base || base.length > MAX_NAME_LENGTH) return null;
	if (base.startsWith('.')) return null; // rules out '.', '..' and dotfiles
	if (CONTROL_CHARS.test(base)) return null;

	const lower = base.toLowerCase();
	if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return null;

	return base;
}

/**
 * Recognizes adapter-node's body-size-limit failure and turns it into something actionable.
 * That check runs in `getRequest`, before this route's handler, and surfaces as a plain Error
 * when the body is read — so without this it reaches the client as a bare 500 "Internal Error"
 * that says nothing about the real cause. Returns null for unrelated errors.
 */
export function bodySizeLimitError(message: string): string | null {
	const m = /Content-length of (\d+) exceeds limit of (\d+) bytes/i.exec(message);
	if (!m) return null;

	const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
	return `File is ${mb(Number(m[1]))} but the server accepts at most ${mb(Number(m[2]))}. Raise BODY_SIZE_LIMIT.`;
}

/** Upstream path for one file. Shared by the request line and the Digest `uri`. */
export function filePath(storage: string, name: string): string {
	return `/api/v1/files/${storage}/${encodeURIComponent(name)}`;
}

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');

type RawStorage = {
	name?: string;
	type?: string;
	path?: string;
	free_space?: number;
	total_space?: number;
	available?: boolean;
	read_only?: boolean;
};

/**
 * Chooses which storage to write to: an explicit override wins, otherwise the first storage
 * that is actually usable. Falls back to 'usb', the Buddy-firmware default.
 */
export function pickStorage(list: RawStorage[] | undefined, override?: string): string {
	if (override) return trimSlashes(override);

	const usable = (list ?? []).find((s) => s.available && !s.read_only && s.path);
	if (usable?.path) return trimSlashes(usable.path);

	return 'usb';
}

type RawChild = {
	name?: string;
	display_name?: string;
	type?: string;
	size?: number;
	read_only?: boolean;
};

async function getJson<T>(printer: Printer, path: string): Promise<T | null> {
	const res = await authSend(printer, 'GET', path, {
		headers: { Accept: 'application/json' },
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
	if (res.status === 204) return null;
	if (!res.ok) throw new Error(`PrusaLink ${path} -> ${res.status}`);
	return (await res.json()) as T;
}

/**
 * Resolves the storage name for this printer. Also returned by fetchFiles so the UI can show
 * free space; the mutating calls resolve it again (one cheap request) to stay stateless.
 */
async function resolveStorage(
	printer: Printer
): Promise<{ storage: string; info?: PrinterStorage }> {
	if (printer.prusaLinkStorage) {
		return { storage: trimSlashes(printer.prusaLinkStorage) };
	}

	const raw = await getJson<{ storage_list?: RawStorage[] }>(printer, '/api/v1/storage').catch(
		() => null
	);
	const list = raw?.storage_list ?? [];
	const storage = pickStorage(list);
	const match = list.find((s) => s.path && trimSlashes(s.path) === storage);

	return {
		storage,
		info: match
			? {
					name: match.name ?? storage,
					available: match.available ?? false,
					readOnly: match.read_only ?? false,
					freeSpace: match.free_space,
					totalSpace: match.total_space,
				}
			: undefined,
	};
}

/**
 * Lists the print files on the target storage. Mirrors fetchPrusaStatus: never throws, it
 * reports `online: false` with a message so the panel can explain itself.
 */
export async function fetchFiles(printer: Printer): Promise<PrinterFiles> {
	if (!printer.prusaLinkHost) {
		return { online: false, files: [], error: 'PrusaLink not configured' };
	}

	try {
		const { storage, info } = await resolveStorage(printer);
		const folder = await getJson<{ children?: RawChild[] }>(printer, `/api/v1/files/${storage}/`);

		const files = (folder?.children ?? [])
			.filter((c) => {
				if ((c.type ?? '').toUpperCase() === 'FOLDER') return false; // root only, no navigation
				return Boolean(c.name) && sanitizeFileName(c.name as string) !== null;
			})
			.map((c) => ({
				name: c.name as string,
				displayName: c.display_name ?? (c.name as string),
				size: c.size,
				readOnly: c.read_only,
			}));

		return { online: true, storage: info, files };
	} catch (e) {
		return {
			online: false,
			files: [],
			error: e instanceof Error ? e.message : 'PrusaLink unreachable',
		};
	}
}

/** Uploads a file. `Print-After-Upload: ?0` — starting the print is a separate, explicit step. */
export async function uploadFile(
	printer: Printer,
	name: string,
	body: Uint8Array,
	overwrite: boolean
): Promise<Response> {
	const { storage } = await resolveStorage(printer);
	return authSend(printer, 'PUT', filePath(storage, name), {
		body,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/octet-stream',
			'Content-Length': String(body.byteLength),
			'Print-After-Upload': '?0',
			Overwrite: overwrite ? '?1' : '?0',
		},
		timeoutMs: UPLOAD_TIMEOUT_MS,
	});
}

export async function startPrint(printer: Printer, name: string): Promise<Response> {
	const { storage } = await resolveStorage(printer);
	return authSend(printer, 'POST', filePath(storage, name), {
		headers: { Accept: 'application/json' },
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
}

export async function deleteFile(printer: Printer, name: string): Promise<Response> {
	const { storage } = await resolveStorage(printer);
	return authSend(printer, 'DELETE', filePath(storage, name), {
		headers: { Accept: 'application/json', Force: '?0' },
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
}
