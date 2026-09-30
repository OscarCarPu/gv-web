// Chunked upload staging for print files.
//
// Why this exists: the Cloudflare tunnel in front of the app rejects request bodies over 100 MB
// (Free and Pro plans), which cuts a large .gcode off mid-transfer with no readable error. So the
// browser sends the file as a series of PATCH requests, each well under that cap, and this module
// stages them on disk until the last one arrives. The assembled bytes then take the same path as a
// plain PUT: buffered, acknowledged with 202, forwarded to PrusaLink in the background.
//
// Chunks must arrive in order and each is addressed by its byte offset, which makes a retry
// idempotent: re-sending a chunk that already landed is acknowledged without being written twice,
// and a gap reports how many bytes the server really has so the client can resync.

import { appendFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Staging directory. Temporary by nature, so the container's own filesystem is fine. */
const ROOT = process.env.PRINTER_UPLOADS_DIR || join(tmpdir(), 'gv-print-uploads');

/**
 * Ceiling on an assembled file. The final step holds the whole file in memory (PrusaLink wants a
 * real Content-Length and the digest retry must replay the body), so this bounds that too.
 */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/** Abandoned partial uploads older than this are deleted. */
const STALE_MS = 60 * 60_000;

export class ChunkError extends Error {
	readonly status: number;
	/** Bytes the server really has, so the client can resume from there. Set on an offset mismatch. */
	readonly received?: number;
	constructor(message: string, status: number, received?: number) {
		super(message);
		this.name = 'ChunkError';
		this.status = status;
		this.received = received;
	}
}

export type ChunkResult = { received: number; complete: boolean };

const partPath = (uploadId: string) => join(ROOT, `${uploadId}.part`);

async function sizeOf(path: string): Promise<number> {
	try {
		return (await stat(path)).size;
	} catch {
		return 0;
	}
}

/** Parses a non-negative integer header, or null when it is missing or malformed. */
export function parseByteHeader(raw: string | null): number | null {
	if (raw == null || !/^\d{1,15}$/.test(raw)) return null;
	return Number(raw);
}

/**
 * Appends one chunk. `uploadId` must already be sanitized (it becomes a file name).
 *
 * - offset === bytes already staged: the chunk is written.
 * - offset + length <= bytes already staged: a retry of a chunk that landed; acknowledged, not rewritten.
 * - anything else is a gap or an overlap, reported with the real size so the client can resync.
 */
export async function appendChunk(
	uploadId: string,
	offset: number,
	total: number,
	chunk: Uint8Array
): Promise<ChunkResult> {
	if (total <= 0) throw new ChunkError('Missing upload total', 400);
	if (total > MAX_UPLOAD_BYTES) {
		const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(0)} MB`;
		throw new ChunkError(`File is ${mb(total)}; the limit is ${mb(MAX_UPLOAD_BYTES)}.`, 413);
	}
	if (chunk.byteLength === 0) throw new ChunkError('Empty chunk', 400);
	if (offset + chunk.byteLength > total) {
		throw new ChunkError('Chunk runs past the declared file size', 400);
	}

	await mkdir(ROOT, { recursive: true });
	const path = partPath(uploadId);
	const have = await sizeOf(path);

	if (offset + chunk.byteLength <= have) {
		return { received: have, complete: have === total };
	}
	if (offset !== have) {
		throw new ChunkError('Chunk out of order', 409, have);
	}

	await appendFile(path, chunk);
	const received = have + chunk.byteLength;
	return { received, complete: received === total };
}

/** Reads the assembled file. Call only once appendChunk reported `complete`. */
export async function readAssembled(uploadId: string): Promise<Uint8Array> {
	return new Uint8Array(await readFile(partPath(uploadId)));
}

export async function discardUpload(uploadId: string): Promise<void> {
	await rm(partPath(uploadId), { force: true });
}

/** Deletes partial uploads nobody finished. Cheap enough to run on every new upload. */
export async function sweepStaleUploads(now = Date.now()): Promise<void> {
	let names: string[];
	try {
		names = await readdir(ROOT);
	} catch {
		return; // nothing staged yet
	}
	await Promise.all(
		names
			.filter((n) => n.endsWith('.part'))
			.map(async (n) => {
				const path = join(ROOT, n);
				try {
					if (now - (await stat(path)).mtimeMs > STALE_MS) await rm(path, { force: true });
				} catch {
					// Raced with another cleanup — already gone.
				}
			})
	);
}
