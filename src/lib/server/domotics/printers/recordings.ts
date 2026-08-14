// Server-side camera recording for a printer.
//
// Recording is a backend job, not a browser one: ffmpeg pulls the RTSP stream straight to disk,
// so it keeps going with no page open, across reloads and navigations. The UI only starts it,
// stops it and lists what is on disk.
//
// Deliberately separate from ./camera.ts. That module keeps one warm ffmpeg per printer for the
// live preview and kills it after 30s idle — exactly the wrong lifecycle for a recording. A
// second RTSP session to the camera is the price of letting the preview idle out independently.
//
// Everything the UI shows is derived from the files themselves (name = start time, mtime = end
// time, size = size), so a restart mid-recording loses the ffmpeg handle but never the recording.

import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Printer } from './config';

/** Where recordings live. Matches the Docker volume mount; relative paths resolve against cwd. */
const ROOT = process.env.PRINTER_RECORDINGS_DIR || 'data/recordings';
/** Hard stop, so a recording someone forgot about cannot run forever. */
const MAX_MINUTES = envNumber(process.env.PRINTER_RECORDING_MAX_MINUTES, 240);
/** Retention budget per printer. Oldest recordings are pruned to stay under it. */
const MAX_BYTES = envNumber(process.env.PRINTER_RECORDINGS_MAX_GB, 10) * 1024 ** 3;
/**
 * `copy` muxes the camera's own H.264 with no re-encode — the whole point, since this box has no
 * cycles to spare. Override with a real encoder (e.g. `libx264`) only if the source codec turns
 * out to be something browsers will not play.
 */
const VIDEO_CODEC = process.env.PRINTER_RECORDING_VIDEO_CODEC || 'copy';

/** How long ffmpeg gets to finish the file itself before signals escalate. */
const STOP_GRACE_MS = 5_000;
const STOP_KILL_MS = 8_000;
/** How long start waits to see whether the stream actually came up. */
const START_PROBE_MS = 8_000;
/** Enough stderr to explain a failure, not enough to be a leak. */
const STDERR_KEEP = 2_000;

function envNumber(raw: string | undefined, fallback: number): number {
	const n = raw != null && raw !== '' ? Number(raw) : NaN;
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Carries the HTTP status the route should answer with, so callers do not match on messages. */
export class RecordingError extends Error {
	readonly status: number;
	constructor(message: string, status = 502) {
		super(message);
		this.name = 'RecordingError';
		this.status = status;
	}
}

export type Recording = {
	/** File name, which is also its start timestamp. */
	name: string;
	startedAt: string;
	/** Absent while it is still being written. */
	endedAt?: string;
	durationMs: number;
	sizeBytes: number;
	/** True for the one ffmpeg is writing right now. */
	recording: boolean;
	/** Poster file name, when a still could be extracted. */
	poster?: string;
};

export type RecordingsView = {
	recordings: Recording[];
	usedBytes: number;
	maxBytes: number;
};

/**
 * Both the name format and the sanitizer: nothing but a timestamp we generated matches, so a
 * client-supplied name can never walk out of the printer's folder.
 */
const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})\.(mp4|jpg)$/;

/** UTC start time as a file name: `2026-08-06T14-32-05.mp4`. */
export function recordingName(at: Date): string {
	return `${at.toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
}

/** Start time encoded in a recording's file name, or null when the name is not one of ours. */
export function parseRecordingName(name: string): Date | null {
	const m = NAME_RE.exec(name);
	if (!m) return null;
	const [, y, mo, d, h, mi, s] = m;
	const at = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
	return Number.isNaN(at.getTime()) ? null : at;
}

function posterName(mp4: string): string {
	return mp4.replace(/\.mp4$/, '.jpg');
}

function dirFor(printerId: string): string {
	return join(ROOT, printerId);
}

/** Absolute-ish path for a recording or its poster, or null if the name is not acceptable. */
export function recordingPath(printerId: string, name: string): string | null {
	if (!parseRecordingName(name)) return null;
	return join(dirFor(printerId), name);
}

// ---- active recordings ----

type Active = {
	name: string;
	path: string;
	proc: ChildProcess;
	stderr: string;
	exited: boolean;
	stopping: boolean;
};

const active = new Map<string, Active>();

/** The recording ffmpeg is writing for this printer, if any. */
export function activeRecording(printerId: string): { name: string } | null {
	const live = active.get(printerId);
	return live ? { name: live.name } : null;
}

// ---- listing ----

/**
 * Everything on disk for a printer, newest first.
 *
 * Duration is wall-clock — file name to mtime — rather than a container probe: ffmpeg writes
 * continuously, so mtime is when the stream stopped, and this avoids an ffprobe per row on every
 * poll. It therefore includes the second or two ffmpeg spends connecting to the camera.
 */
export async function listRecordings(printerId: string): Promise<Recording[]> {
	const dir = dirFor(printerId);
	const names = await readdir(dir).catch(() => [] as string[]);
	const posters = new Set(names.filter((n) => n.endsWith('.jpg')));
	const live = active.get(printerId);

	const out: Recording[] = [];
	for (const name of names) {
		if (!name.endsWith('.mp4')) continue;
		const startedAt = parseRecordingName(name);
		if (!startedAt) continue;

		const st = await stat(join(dir, name)).catch(() => null);
		if (!st?.isFile()) continue;

		const recording = live?.name === name;
		const end = recording ? Date.now() : st.mtimeMs;
		const poster = posters.has(posterName(name)) ? posterName(name) : undefined;

		out.push({
			name,
			startedAt: startedAt.toISOString(),
			endedAt: recording ? undefined : new Date(st.mtimeMs).toISOString(),
			durationMs: Math.max(0, end - startedAt.getTime()),
			sizeBytes: st.size,
			recording,
			poster,
		});
	}

	return out.sort((a, b) => b.name.localeCompare(a.name));
}

export async function recordingsView(printerId: string): Promise<RecordingsView> {
	const recordings = await listRecordings(printerId);
	return {
		recordings,
		usedBytes: recordings.reduce((sum, r) => sum + r.sizeBytes, 0),
		maxBytes: MAX_BYTES,
	};
}

// ---- retention ----

/**
 * Deletes oldest-first until the folder is back inside the retention budget. Never touches the
 * recording in progress, and always keeps the most recent finished one — a single oversized
 * recording is still the one thing the user most likely wants to watch.
 */
export async function pruneOldest(printerId: string): Promise<void> {
	const list = await listRecordings(printerId);
	let total = list.reduce((sum, r) => sum + r.sizeBytes, 0);
	if (total <= MAX_BYTES) return;

	const prunable = list.filter((r) => !r.recording).sort((a, b) => a.name.localeCompare(b.name));
	prunable.pop();

	for (const r of prunable) {
		if (total <= MAX_BYTES) return;
		await removeFiles(printerId, r.name);
		total -= r.sizeBytes;
	}
}

async function removeFiles(printerId: string, name: string): Promise<void> {
	const dir = dirFor(printerId);
	await rm(join(dir, name), { force: true });
	await rm(join(dir, posterName(name)), { force: true });
}

// ---- start / stop ----

/** Picks a free name — stop-then-start inside the same second would otherwise collide. */
async function freeName(dir: string): Promise<{ name: string; at: Date }> {
	let at = new Date();
	for (let i = 0; i < 60; i++) {
		const name = recordingName(at);
		if (!(await stat(join(dir, name)).catch(() => null))) return { name, at };
		at = new Date(at.getTime() + 1000);
	}
	throw new RecordingError('Could not allocate a recording file name');
}

export async function startRecording(printer: Printer): Promise<Recording> {
	if (active.has(printer.id)) {
		throw new RecordingError('This printer is already recording', 409);
	}

	const dir = dirFor(printer.id);
	await mkdir(dir, { recursive: true }).catch((e) => {
		throw new RecordingError(
			`Recordings folder is not writable: ${e instanceof Error ? e.message : dir}`
		);
	});
	// Make room before writing, not after — the disk has to hold what we are about to record.
	await pruneOldest(printer.id);

	const { name, at } = await freeName(dir);
	const path = join(dir, name);

	const proc = spawn(
		'ffmpeg',
		[
			'-loglevel',
			'error',
			'-rtsp_transport',
			'tcp',
			'-i',
			printer.rtsp,
			'-an',
			'-c:v',
			VIDEO_CODEC,
			'-f',
			'mp4',
			// Fragmented: the file stays playable even when the process is killed or the container
			// restarts mid-recording, because there is no trailer left to write.
			'-movflags',
			'+frag_keyframe+empty_moov+default_base_moof',
			'-t',
			String(Math.round(MAX_MINUTES * 60)),
			// Never let one recording eat the whole retention budget.
			'-fs',
			String(Math.round(MAX_BYTES)),
			path,
		],
		{ stdio: ['pipe', 'ignore', 'pipe'] }
	);

	const live: Active = { name, path, proc, stderr: '', exited: false, stopping: false };
	active.set(printer.id, live);

	proc.stderr?.on('data', (chunk: Buffer) => {
		live.stderr = (live.stderr + chunk.toString()).slice(-STDERR_KEEP);
	});

	// 'error' fires instead of 'exit' when the binary itself cannot be run (ffmpeg not installed).
	proc.on('error', (e) => {
		live.exited = true;
		live.stderr = `${live.stderr}\n${e.message}`.slice(-STDERR_KEEP);
		active.delete(printer.id);
	});

	proc.on('exit', () => {
		live.exited = true;
		active.delete(printer.id);
		// Best-effort housekeeping; nothing here is worth failing a request over.
		void makePoster(path).finally(() => pruneOldest(printer.id).catch(() => {}));
	});

	// ffmpeg fails late: an unreachable camera or a bad URL surfaces seconds after spawn, long
	// after this would have returned "recording". Wait for the first bytes on disk (the fmp4 init
	// segment, written once the stream is up) or an early exit, so a recording that never starts
	// is reported as an error rather than as a row that silently never grows.
	const deadline = Date.now() + START_PROBE_MS;
	while (Date.now() < deadline) {
		if (live.exited) {
			await removeFiles(printer.id, name);
			throw new RecordingError(firstErrorLine(live.stderr) ?? 'ffmpeg stopped immediately');
		}
		const st = await stat(path).catch(() => null);
		if (st && st.size > 0) break;
		await sleep(150);
	}

	const st = await stat(path).catch(() => null);
	return {
		name,
		startedAt: at.toISOString(),
		durationMs: Math.max(0, Date.now() - at.getTime()),
		sizeBytes: st?.size ?? 0,
		recording: true,
	};
}

/** The line worth showing a human out of an ffmpeg stderr dump. */
export function firstErrorLine(stderr: string): string | null {
	const line = stderr
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.pop();
	return line ? line.slice(0, 200) : null;
}

export async function stopRecording(printerId: string): Promise<void> {
	const live = active.get(printerId);
	if (!live) throw new RecordingError('This printer is not recording', 409);
	if (live.stopping) return;
	live.stopping = true;

	// 'q' on stdin is ffmpeg's graceful shutdown — it closes the current fragment instead of
	// leaving a torn one. Signals are the fallback if it does not act on it.
	try {
		live.proc.stdin?.write('q');
		live.proc.stdin?.end();
	} catch {
		// stdin already gone; the signals below still apply.
	}

	await new Promise<void>((resolve) => {
		if (live.exited) return resolve();
		const term = setTimeout(() => live.proc.kill('SIGTERM'), STOP_GRACE_MS);
		const kill = setTimeout(() => live.proc.kill('SIGKILL'), STOP_KILL_MS);
		const done = () => {
			clearTimeout(term);
			clearTimeout(kill);
			resolve();
		};
		live.proc.once('exit', done);
		live.proc.once('error', done);
	});
}

export async function deleteRecording(printerId: string, name: string): Promise<void> {
	if (!parseRecordingName(name)) throw new RecordingError('Invalid recording name', 400);
	if (active.get(printerId)?.name === name) {
		throw new RecordingError('That recording is still running. Stop it first.', 409);
	}

	const path = join(dirFor(printerId), name);
	if (!(await stat(path).catch(() => null))) {
		throw new RecordingError('Recording not found', 404);
	}
	await removeFiles(printerId, name);
}

// ---- posters ----

function runFfmpeg(args: string[]): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn('ffmpeg', ['-loglevel', 'error', ...args], { stdio: 'ignore' });
		proc.on('error', () => resolve(false));
		proc.on('exit', (code) => resolve(code === 0));
	});
}

/**
 * Extracts a still for the recordings list. Best effort by design: a missing poster only costs a
 * placeholder tile, and very short recordings have nothing at the 1s mark to grab.
 */
async function makePoster(path: string): Promise<void> {
	const out = posterName(path);
	for (const seek of [['-ss', '1'], []]) {
		await runFfmpeg([...seek, '-i', path, '-frames:v', '1', '-q:v', '5', '-y', out]);
		if ((await stat(out).catch(() => null))?.size) return;
	}
	await rm(out, { force: true });
}

// ---- playback ----

export type ByteRange = { start: number; end: number };

/**
 * Parses a single-range `Range` header against a known size. Returns null when there is nothing
 * usable to honour, in which case the caller serves the whole file — <video> seeking needs 206
 * responses, but a malformed header is not worth a 416.
 */
export function parseRange(header: string | null, size: number): ByteRange | null {
	if (!header || size <= 0) return null;
	const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!m) return null;

	const [, rawStart, rawEnd] = m;
	if (rawStart === '' && rawEnd === '') return null;

	// `bytes=-N` asks for the final N bytes.
	if (rawStart === '') {
		const len = Number(rawEnd);
		if (!len) return null;
		return { start: Math.max(0, size - len), end: size - 1 };
	}

	const start = Number(rawStart);
	if (start >= size) return null;
	const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
	if (end < start) return null;

	return { start, end };
}

/** Opens a recording (or its poster) for streaming. Null when the name or file is no good. */
export async function openRecording(
	printerId: string,
	name: string
): Promise<{ path: string; size: number; mtimeMs: number; live: boolean } | null> {
	const path = recordingPath(printerId, name);
	if (!path) return null;
	const st = await stat(path).catch(() => null);
	if (!st?.isFile()) return null;
	return {
		path,
		size: st.size,
		mtimeMs: st.mtimeMs,
		live: active.get(printerId)?.name === name,
	};
}

export function readRange(path: string, range: ByteRange | null) {
	return createReadStream(path, range ? { start: range.start, end: range.end } : undefined);
}
