// Server-side proxy to a printer's local PrusaLink API (Buddy firmware, Core One).
// Auth is HTTP Digest (user + password) — the default on Buddy firmware — with an
// X-Api-Key fallback. Normalizes the raw payload into a stable shape for the UI
// and degrades gracefully when PrusaLink is not configured or unreachable.

import { createHash, randomBytes } from 'node:crypto';
import type { Printer } from './config';

type PrinterTelemetry = {
	configured: boolean;
	online: boolean;
	state?: string;
	temps: {
		nozzle?: number;
		nozzleTarget?: number;
		bed?: number;
		bedTarget?: number;
		chamber?: number;
	};
	fans: { hotend?: number; print?: number };
	axisZ?: number;
	speed?: number;
	flow?: number;
	job?: {
		progress?: number;
		timeRemaining?: number;
		timePrinting?: number;
		fileName?: string;
		material?: string;
	};
	error?: string;
};

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/** Exported for unit tests. */
export function parseChallenge(header: string): Record<string, string> {
	const out: Record<string, string> = {};
	const body = header.replace(/^Digest\s+/i, '');
	const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(body))) out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? '').trim();
	return out;
}

/** Exported for unit tests. */
export function digestHeader(
	user: string,
	pass: string,
	method: string,
	uri: string,
	challenge: Record<string, string>
): string {
	const realm = challenge.realm ?? '';
	const nonce = challenge.nonce ?? '';
	const opaque = challenge.opaque;
	const algorithm = challenge.algorithm ?? 'MD5';
	const qop = challenge.qop ? challenge.qop.split(',')[0].trim() : undefined;
	const nc = '00000001';
	const cnonce = randomBytes(8).toString('hex');

	const ha1 = md5(`${user}:${realm}:${pass}`);
	const ha2 = md5(`${method}:${uri}`);
	const response = qop
		? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
		: md5(`${ha1}:${nonce}:${ha2}`);

	let h = `Digest username="${user}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm=${algorithm}, response="${response}"`;
	if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
	if (opaque) h += `, opaque="${opaque}"`;
	return h;
}

/**
 * Cached Digest challenge per host. Valid because the Core One's challenge carries no `qop`, so
 * the response does not depend on a nonce count and a nonce may be reused. This halves the
 * request count: without it every single call paid for its own challenge probe, which matters now
 * that listing files fans out to one request per file.
 */
const challengeCache = new Map<string, Record<string, string>>();

/**
 * Fetches a Digest challenge with a cheap unauthenticated GET. Doing this up front lets a
 * write request send its (possibly multi-MB) body exactly once instead of losing the first
 * attempt to a 401. Returns null when the printer does not answer with a Digest challenge.
 *
 * Pass `force` to bypass the cache after a 401 (stale nonce).
 */
async function getChallenge(
	printer: Printer,
	force = false
): Promise<Record<string, string> | null> {
	const host = printer.prusaLinkHost!.replace(/\/$/, '');
	if (!force) {
		const cached = challengeCache.get(host);
		if (cached) return cached;
	}

	const res = await fetch(`${host}/api/v1/status`, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(4000),
	});
	await res.arrayBuffer().catch(() => {}); // drain the socket
	if (res.status !== 401) return null;

	const wwwAuth = res.headers.get('www-authenticate');
	if (!wwwAuth || !/digest/i.test(wwwAuth)) return null;

	const challenge = parseChallenge(wwwAuth);
	challengeCache.set(host, challenge);
	return challenge;
}

type SendOptions = {
	/**
	 * Either a buffer, or a factory returning a fresh body per attempt. The factory form exists
	 * for streamed uploads: a ReadableStream cannot be replayed, so the stale-nonce retry needs
	 * a new one. Bun keeps an explicit Content-Length with a stream body (verified), which
	 * PrusaLink requires.
	 */
	body?: Uint8Array | (() => BodyInit);
	headers?: Record<string, string>;
	timeoutMs?: number;
};

/**
 * Performs an authenticated request against PrusaLink. `path` is used verbatim both as the
 * request path and as the Digest `uri`, so it must already be encoded.
 *
 * The Core One challenge carries no `qop`, so the digest response does not depend on a nonce
 * count and a nonce may be reused across requests — which is what makes the send-once flow
 * below safe. A 401 still triggers one retry with a fresh challenge (stale nonce); `body` is a
 * Uint8Array precisely so it can be re-sent.
 */
export async function authSend(
	printer: Printer,
	method: string,
	path: string,
	opts: SendOptions = {}
): Promise<Response> {
	const host = printer.prusaLinkHost!.replace(/\/$/, '');
	const url = `${host}${path}`;
	const timeout = opts.timeoutMs ?? 10_000;
	const base: Record<string, string> = { ...opts.headers };

	const streamed = typeof opts.body === 'function';
	const send = (headers: Record<string, string>) => {
		const body = streamed ? (opts.body as () => BodyInit)() : (opts.body as Uint8Array | undefined);
		const init: RequestInit & { duplex?: 'half' } = {
			method,
			headers,
			body: body as BodyInit | undefined,
			signal: AbortSignal.timeout(timeout),
		};
		if (streamed) init.duplex = 'half'; // required when the body is a stream
		return fetch(url, init);
	};

	if (printer.prusaLinkApiKey) {
		return send({ ...base, 'X-Api-Key': printer.prusaLinkApiKey });
	}
	if (!printer.prusaLinkUser) return send(base);

	const user = printer.prusaLinkUser;
	const pass = printer.prusaLinkPassword ?? '';

	const challenge = await getChallenge(printer);
	if (!challenge) return send(base);

	const first = await send({
		...base,
		Authorization: digestHeader(user, pass, method, path, challenge),
	});
	if (first.status !== 401) return first;

	// Stale nonce — re-challenge (bypassing the cache) once and replay.
	await first.arrayBuffer().catch(() => {});
	const fresh = await getChallenge(printer, true);
	if (!fresh) return first;
	return send({ ...base, Authorization: digestHeader(user, pass, method, path, fresh) });
}

function authGet(printer: Printer, path: string): Promise<Response> {
	return authSend(printer, 'GET', path, {
		headers: { Accept: 'application/json' },
		timeoutMs: 4000,
	});
}

async function getJson<T>(printer: Printer, path: string): Promise<T | null> {
	const res = await authGet(printer, path);
	if (res.status === 204) return null; // e.g. /api/v1/job when idle
	if (!res.ok) throw new Error(`PrusaLink ${path} -> ${res.status}`);
	return (await res.json()) as T;
}

interface PrusaPrinter {
	state?: string;
	temp_nozzle?: number;
	target_nozzle?: number;
	temp_bed?: number;
	target_bed?: number;
	temp_chamber?: number;
	axis_z?: number;
	speed?: number;
	flow?: number;
	fan_hotend?: number;
	fan_print?: number;
}
interface PrusaJob {
	progress?: number;
	time_remaining?: number;
	time_printing?: number;
	file?: { name?: string; display_name?: string; meta?: { filament_type?: string } };
}
interface PrusaStatusResp {
	printer?: PrusaPrinter;
	job?: PrusaJob;
}
interface PrusaLegacy {
	telemetry?: { material?: string };
}

export async function fetchPrusaStatus(printer: Printer): Promise<PrinterTelemetry> {
	const empty: PrinterTelemetry = {
		configured: Boolean(printer.prusaLinkHost),
		online: false,
		temps: {},
		fans: {},
	};
	if (!printer.prusaLinkHost) return empty;

	try {
		const [status, job, legacy] = await Promise.all([
			getJson<PrusaStatusResp>(printer, '/api/v1/status'),
			getJson<PrusaJob>(printer, '/api/v1/job').catch(() => null),
			// Legacy OctoPrint-compat endpoint — only place that reports the loaded material.
			getJson<PrusaLegacy>(printer, '/api/printer').catch(() => null),
		]);

		const p = status?.printer ?? {};
		const j = job ?? status?.job ?? null;
		const material = j?.file?.meta?.filament_type ?? legacy?.telemetry?.material;

		return {
			configured: true,
			online: true,
			state: p.state,
			temps: {
				nozzle: p.temp_nozzle,
				nozzleTarget: p.target_nozzle,
				bed: p.temp_bed,
				bedTarget: p.target_bed,
				chamber: p.temp_chamber,
			},
			fans: { hotend: p.fan_hotend, print: p.fan_print },
			axisZ: p.axis_z,
			speed: p.speed,
			flow: p.flow,
			job: j
				? {
						progress: j.progress ?? status?.job?.progress,
						timeRemaining: j.time_remaining ?? status?.job?.time_remaining,
						timePrinting: j.time_printing ?? status?.job?.time_printing,
						fileName: j.file?.display_name ?? j.file?.name,
						material,
					}
				: undefined,
		};
	} catch (e) {
		return {
			...empty,
			configured: true,
			error: e instanceof Error ? e.message : 'PrusaLink unreachable',
		};
	}
}
