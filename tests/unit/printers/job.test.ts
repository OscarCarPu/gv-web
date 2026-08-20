import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	fetchCurrentJobId,
	stopCurrentJob,
	stopErrorMessage,
} from '$lib/server/domotics/printers/job';
import { isStoppableState } from '$lib/domains/domotics/printers/printerStatus.svelte';
import type { Printer } from '$lib/server/domotics/printers/config';

// An API key printer, so authSend sends exactly one request per call and the fetch mock below
// does not have to play the Digest challenge dance.
const printer: Printer = {
	id: 'core-one',
	name: 'Prusa CORE One',
	model: 'Prusa CORE One',
	rtsp: 'rtsp://printer/live',
	prusaLinkHost: 'http://printer',
	prusaLinkApiKey: 'k',
};

type Reply = { status: number; body?: unknown };

/** Stubs global fetch, answering by (method, path) and recording what was asked for. */
function mockFetch(replies: Record<string, Reply>) {
	const calls: string[] = [];
	const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const method = (init?.method ?? 'GET').toUpperCase();
		const path = new URL(String(input)).pathname;
		const key = `${method} ${path}`;
		calls.push(key);

		const reply = replies[key];
		if (!reply) throw new Error(`unexpected request: ${key}`);
		const body = reply.body === undefined ? null : JSON.stringify(reply.body);
		return new Response(body, { status: reply.status });
	});
	return { calls, spy };
}

afterEach(() => vi.restoreAllMocks());

describe('fetchCurrentJobId', () => {
	it('reads the id of the running job', async () => {
		mockFetch({ 'GET /api/v1/job': { status: 200, body: { id: 42, state: 'PRINTING' } } });
		await expect(fetchCurrentJobId(printer)).resolves.toBe(42);
	});

	// PrusaLink answers 204 (no job resource at all) when the printer is idle.
	it('reports null when the printer is idle', async () => {
		mockFetch({ 'GET /api/v1/job': { status: 204 } });
		await expect(fetchCurrentJobId(printer)).resolves.toBeNull();
	});

	it('throws when the printer answers with an error', async () => {
		mockFetch({ 'GET /api/v1/job': { status: 500 } });
		await expect(fetchCurrentJobId(printer)).rejects.toThrow('500');
	});
});

describe('stopCurrentJob', () => {
	it('cancels the job the printer reports as running', async () => {
		const { calls } = mockFetch({
			'GET /api/v1/job': { status: 200, body: { id: 7 } },
			'DELETE /api/v1/job/7': { status: 204 },
		});

		await expect(stopCurrentJob(printer)).resolves.toEqual({ outcome: 'stopped' });
		expect(calls).toEqual(['GET /api/v1/job', 'DELETE /api/v1/job/7']);
	});

	// Nothing running must not turn into a DELETE against a guessed id.
	it('stops at the lookup when the printer is idle', async () => {
		const { calls } = mockFetch({ 'GET /api/v1/job': { status: 204 } });

		await expect(stopCurrentJob(printer)).resolves.toEqual({ outcome: 'idle' });
		expect(calls).toEqual(['GET /api/v1/job']);
	});

	it('passes a refusal through with its status', async () => {
		mockFetch({
			'GET /api/v1/job': { status: 200, body: { id: 7 } },
			'DELETE /api/v1/job/7': { status: 409 },
		});

		await expect(stopCurrentJob(printer)).resolves.toEqual({ outcome: 'rejected', status: 409 });
	});
});

describe('stopErrorMessage', () => {
	it('explains the refusals the printer actually sends', () => {
		expect(stopErrorMessage(409)).toContain('current state');
		expect(stopErrorMessage(404)).toContain('already finished');
		expect(stopErrorMessage(401)).toContain('credentials');
	});

	it('falls back to the status code for anything unrecognised', () => {
		expect(stopErrorMessage(418)).toBe('PrusaLink returned 418');
	});
});

describe('isStoppableState', () => {
	it('accepts the states that have a job to stop', () => {
		expect(isStoppableState('PRINTING')).toBe(true);
		expect(isStoppableState('PAUSED')).toBe(true);
		// ATTENTION is mid-print (filament runout, for one) — stopping is exactly what is wanted.
		expect(isStoppableState('ATTENTION')).toBe(true);
		expect(isStoppableState('printing')).toBe(true);
	});

	it('rejects the states where there is nothing to stop', () => {
		expect(isStoppableState('IDLE')).toBe(false);
		expect(isStoppableState('READY')).toBe(false);
		expect(isStoppableState('FINISHED')).toBe(false);
		expect(isStoppableState('STOPPED')).toBe(false);
		expect(isStoppableState(undefined)).toBe(false);
		expect(isStoppableState('')).toBe(false);
	});
});
