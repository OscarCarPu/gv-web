// Single warm ffmpeg connection per printer RTSP stream.
//
// ffmpeg pulls the H.264 stream once, decodes it and emits a low-rate MJPEG on
// stdout. We demux the MJPEG boundaries and keep only the latest complete JPEG
// frame in memory. Every browser snapshot request returns that buffer instantly
// — no reconnect, no per-request ffmpeg spawn, minimal load on the printer.
//
// The process starts lazily on first request and is killed after IDLE_MS with no
// access, so nothing runs when nobody is watching.

import { spawn, type ChildProcess } from 'node:child_process';

const CAPTURE_FPS = 5; // frames per second pulled from the stream
const IDLE_MS = 30_000;
const MAX_BUFFER = 4_000_000; // guard against unbounded growth on a stalled stream
const SOI = Buffer.from([0xff, 0xd8]); // JPEG start-of-image
const EOI = Buffer.from([0xff, 0xd9]); // JPEG end-of-image

type Cam = {
	proc: ChildProcess | null;
	latest: Buffer | null;
	pending: Buffer;
	lastAccess: number;
	idleTimer: ReturnType<typeof setInterval> | null;
	url: string;
};

const cams = new Map<string, Cam>();

function spawnFfmpeg(cam: Cam) {
	const proc = spawn(
		'ffmpeg',
		[
			'-loglevel',
			'error',
			'-rtsp_transport',
			'tcp',
			'-i',
			cam.url,
			'-an',
			'-vf',
			`fps=${CAPTURE_FPS}`,
			'-f',
			'mjpeg',
			'-q:v',
			'6',
			'pipe:1',
		],
		{ stdio: ['ignore', 'pipe', 'ignore'] }
	);
	cam.proc = proc;
	cam.pending = Buffer.alloc(0);

	proc.stdout?.on('data', (chunk: Buffer) => {
		cam.pending = Buffer.concat([cam.pending, chunk]);
		// Extract every complete JPEG; keep only the newest.
		let start = cam.pending.indexOf(SOI);
		while (start !== -1) {
			const end = cam.pending.indexOf(EOI, start + 2);
			if (end === -1) break;
			cam.latest = cam.pending.subarray(start, end + 2);
			cam.pending = cam.pending.subarray(end + 2);
			start = cam.pending.indexOf(SOI);
		}
		if (cam.pending.length > MAX_BUFFER) cam.pending = Buffer.alloc(0);
	});

	proc.on('exit', () => {
		cam.proc = null;
		// Restart only if someone is still watching (e.g. the printer dropped the stream).
		if (Date.now() - cam.lastAccess < IDLE_MS) spawnFfmpeg(cam);
	});
}

function ensureIdleWatcher(cam: Cam) {
	if (cam.idleTimer) return;
	cam.idleTimer = setInterval(() => {
		if (cam.proc && Date.now() - cam.lastAccess > IDLE_MS) {
			cam.proc.kill('SIGKILL');
			cam.proc = null;
		}
	}, 5000);
}

/** Returns the latest JPEG frame, starting the stream on demand. */
export async function getFrame(id: string, url: string): Promise<Buffer | null> {
	let cam = cams.get(id);
	if (!cam) {
		cam = {
			proc: null,
			latest: null,
			pending: Buffer.alloc(0),
			lastAccess: 0,
			idleTimer: null,
			url,
		};
		cams.set(id, cam);
	}
	cam.url = url;
	cam.lastAccess = Date.now();

	if (!cam.proc) {
		spawnFfmpeg(cam);
		ensureIdleWatcher(cam);
	}

	// Wait for the first frame after a cold start (RTSP connect + keyframe).
	const deadline = Date.now() + 5000;
	while (!cam.latest && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 100));
	}
	return cam.latest;
}
