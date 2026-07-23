// Server-side proxy to a printer's local PrusaLink API (Buddy firmware, Core One).
// Auth is HTTP Digest (user + password) — the default on Buddy firmware — with an
// X-Api-Key fallback. Normalizes the raw payload into a stable shape for the UI
// and degrades gracefully when PrusaLink is not configured or unreachable.

import { createHash, randomBytes } from 'node:crypto';
import type { Printer } from './config';

export type PrinterTelemetry = {
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

function parseChallenge(header: string): Record<string, string> {
	const out: Record<string, string> = {};
	const body = header.replace(/^Digest\s+/i, '');
	const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(body))) out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? '').trim();
	return out;
}

function digestHeader(
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

async function authGet(printer: Printer, path: string): Promise<Response> {
	const host = printer.prusaLinkHost!.replace(/\/$/, '');
	const url = `${host}${path}`;
	const headers: Record<string, string> = { Accept: 'application/json' };

	if (printer.prusaLinkApiKey) {
		headers['X-Api-Key'] = printer.prusaLinkApiKey;
		return fetch(url, { headers, signal: AbortSignal.timeout(4000) });
	}

	// HTTP Digest: first request obtains the challenge, then we retry with the response.
	const first = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
	if (first.status !== 401 || !printer.prusaLinkUser) return first;

	const wwwAuth = first.headers.get('www-authenticate');
	if (!wwwAuth || !/digest/i.test(wwwAuth)) return first;
	await first.arrayBuffer().catch(() => {}); // drain the socket

	const auth = digestHeader(
		printer.prusaLinkUser,
		printer.prusaLinkPassword ?? '',
		'GET',
		path,
		parseChallenge(wwwAuth)
	);
	return fetch(url, {
		headers: { ...headers, Authorization: auth },
		signal: AbortSignal.timeout(4000),
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
