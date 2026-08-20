// Control of the job a printer is running, over PrusaLink's v1 job API.
//
//   GET    /api/v1/job      — the running job (204 when the printer is idle)
//   DELETE /api/v1/job/{id} — stop it
//
// Auth and transport come from ./prusalink; this module owns resolving which job is running and
// classifying the printer's answer. Stopping is final: the firmware discards the job, so there is
// no counterpart that resumes what this cancels.

import type { Printer } from './config';
import { authSend } from './prusalink';

const COMMAND_TIMEOUT_MS = 10_000;

/** Outcome of asking the printer to stop. */
export type StopOutcome =
	| { outcome: 'stopped' }
	/** Nothing to stop — the printer reported no job. */
	| { outcome: 'idle' }
	/** The printer refused; `status` is what it answered with. */
	| { outcome: 'rejected'; status: number };

/** Turns a refusal into something worth showing a human. Exported for unit tests. */
export function stopErrorMessage(status: number): string {
	if (status === 409) return 'The printer will not stop the job in its current state';
	if (status === 404) return 'That job had already finished';
	if (status === 401) return 'PrusaLink rejected the credentials';
	return `PrusaLink returned ${status}`;
}

/** Id of the job running right now, or null when the printer is idle. */
export async function fetchCurrentJobId(printer: Printer): Promise<number | null> {
	const res = await authSend(printer, 'GET', '/api/v1/job', {
		headers: { Accept: 'application/json' },
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
	if (res.status === 204) return null; // idle — no job resource at all
	if (!res.ok) throw new Error(`PrusaLink /api/v1/job -> ${res.status}`);

	const body = (await res.json()) as { id?: number };
	return typeof body.id === 'number' ? body.id : null;
}

/**
 * Stops the running print. Two requests, because PrusaLink addresses the job by id and only the
 * printer knows it — asking first also means a stale browser (page open since the job ended)
 * cancels nothing rather than whatever started since.
 */
export async function stopCurrentJob(printer: Printer): Promise<StopOutcome> {
	const id = await fetchCurrentJobId(printer);
	if (id === null) return { outcome: 'idle' };

	const res = await authSend(printer, 'DELETE', `/api/v1/job/${id}`, {
		headers: { Accept: 'application/json' },
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
	await res.arrayBuffer().catch(() => {}); // success is a bodyless 204; release the connection
	if (!res.ok) return { outcome: 'rejected', status: res.status };
	return { outcome: 'stopped' };
}
