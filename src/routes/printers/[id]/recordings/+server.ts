// Recording endpoints for one printer.
//
//   GET    — what is on disk, plus the one being written right now
//   POST   — ?action=start | ?action=stop
//   DELETE — ?name=… remove a recording
//
// Auth comes for free: hooks.server.ts guards every path under /printers as semiprivate.
// Recording itself runs in the server process, so it survives the page that started it.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPrinter } from '$lib/server/printers/config';
import {
	deleteRecording,
	recordingsView,
	RecordingError,
	startRecording,
	stopRecording,
} from '$lib/server/printers/recordings';

function fail(e: unknown, fallback: string) {
	if (e instanceof RecordingError) return json({ error: e.message }, { status: e.status });
	return json({ error: e instanceof Error ? e.message : fallback }, { status: 502 });
}

export const GET: RequestHandler = async ({ params }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	return json(await recordingsView(printer.id));
};

export const POST: RequestHandler = async ({ params, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	const action = url.searchParams.get('action');

	if (action === 'start') {
		try {
			return json(await startRecording(printer), { status: 201 });
		} catch (e) {
			return fail(e, 'Could not start recording');
		}
	}

	if (action === 'stop') {
		try {
			await stopRecording(printer.id);
			return json(await recordingsView(printer.id));
		} catch (e) {
			return fail(e, 'Could not stop recording');
		}
	}

	return json({ error: 'Unknown action. Expected start or stop.' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	const name = url.searchParams.get('name') ?? '';
	try {
		await deleteRecording(printer.id, name);
		return json({ name });
	} catch (e) {
		return fail(e, 'Could not delete the recording');
	}
};
