// Serves one recording (or its poster) off disk.
//
// Range requests are honoured because <video> needs them to seek: without a 206 the browser has
// to buffer from the start every time the user drags the scrubber. The file name is validated by
// recordings.ts — only timestamps this app generated match — so nothing here can escape the
// printer's folder.

import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import { getPrinter } from '$lib/server/printers/config';
import { openRecording, parseRange, readRange } from '$lib/server/printers/recordings';

export const GET: RequestHandler = async ({ params, request, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return new Response('Printer not found', { status: 404 });

	const file = await openRecording(printer.id, params.name);
	if (!file) return new Response('Recording not found', { status: 404 });

	const range = parseRange(request.headers.get('range'), file.size);
	const length = range ? range.end - range.start + 1 : file.size;

	const headers = new Headers({
		'Content-Type': params.name.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4',
		'Content-Length': String(length),
		'Accept-Ranges': 'bytes',
		// A finished recording never changes; the one being written grows under the player.
		'Cache-Control': file.live ? 'no-store' : 'private, max-age=31536000, immutable',
	});
	if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
	if (url.searchParams.get('download') === '1') {
		headers.set('Content-Disposition', `attachment; filename="${printer.id}_${params.name}"`);
	}

	const stream = Readable.toWeb(readRange(file.path, range)) as ReadableStream;
	return new Response(stream, { status: range ? 206 : 200, headers });
};
