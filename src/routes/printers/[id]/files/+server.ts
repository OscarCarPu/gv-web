// Print-file endpoints for one printer, proxying PrusaLink.
//
//   GET    — list the files on the printer's storage (+ free space)
//   PUT    — upload; filename in the X-File-Name header, raw file as the body
//   POST   — ?name=… start printing an already-uploaded file
//   DELETE — ?name=… remove a file
//
// Auth comes for free: hooks.server.ts guards every path under /printers as semiprivate.
// Clients must send `Accept: application/json` so an expired session yields a JSON 401 rather
// than a 303 redirect to /login.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPrinter } from '$lib/server/printers/config';
import {
	bodySizeLimitError,
	deleteFile,
	fetchFiles,
	sanitizeFileName,
	startPrint,
	uploadFile,
} from '$lib/server/printers/files';
import {
	endUpload,
	sanitizeUploadId,
	setUploadProgress,
	startUpload,
} from '$lib/server/printers/uploadProgress';

/** Turns an upstream PrusaLink status into something worth showing a human. */
function upstreamError(status: number, op: 'upload' | 'print' | 'delete'): string {
	if (status === 409) {
		if (op === 'upload') return 'A file with that name is already on the printer';
		if (op === 'print') return 'A print job is already running';
		return 'That file is currently printing';
	}
	if (status === 507) {
		return 'No USB drive detected in the printer. Check that one is inserted and formatted as FAT32.';
	}
	if (status === 404) return 'The printer rejected the storage path';
	if (status === 401) return 'PrusaLink rejected the credentials';
	return `PrusaLink returned ${status}`;
}

export const GET: RequestHandler = async ({ params }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	return json(await fetchFiles(printer));
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });
	if (!printer.prusaLinkHost) {
		return json({ error: 'PrusaLink not configured' }, { status: 503 });
	}

	const rawHeader = request.headers.get('x-file-name');
	if (!rawHeader) return json({ error: 'Missing X-File-Name header' }, { status: 400 });

	let decoded: string;
	try {
		decoded = decodeURIComponent(rawHeader);
	} catch {
		return json({ error: 'Malformed X-File-Name header' }, { status: 400 });
	}

	const name = sanitizeFileName(decoded);
	if (!name) {
		return json(
			{ error: 'Unsupported file name. Expected a .bgcode, .gcode, .gco or .g file.' },
			{ status: 400 }
		);
	}

	// Buffered rather than streamed on purpose: PrusaLink wants a real Content-Length, and the
	// stale-nonce retry in authSend has to be able to replay the body.
	let body: Uint8Array;
	try {
		body = new Uint8Array(await request.arrayBuffer());
	} catch (e) {
		// adapter-node errors the body stream when Content-Length exceeds BODY_SIZE_LIMIT
		// (512K by default). Left unhandled this is a bare 500 that explains nothing.
		const message = e instanceof Error ? e.message : '';
		const tooLarge = bodySizeLimitError(message);
		if (tooLarge) return json({ error: tooLarge }, { status: 413 });
		return json({ error: 'Could not read the uploaded file' }, { status: 400 });
	}
	if (body.byteLength === 0) return json({ error: 'Empty file' }, { status: 400 });

	// Lets the browser poll the gv-web → printer leg, which XHR progress cannot see.
	const uploadId = sanitizeUploadId(request.headers.get('x-upload-id'));
	if (uploadId) startUpload(uploadId, body.byteLength);

	try {
		const res = await uploadFile(
			printer,
			name,
			body,
			url.searchParams.get('overwrite') === '1',
			uploadId ? (sent) => setUploadProgress(uploadId, sent) : undefined
		);
		if (!res.ok) {
			return json({ error: upstreamError(res.status, 'upload') }, { status: res.status });
		}
		return json({ name });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 502 });
	} finally {
		if (uploadId) endUpload(uploadId);
	}
};

export const POST: RequestHandler = async ({ params, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	const name = sanitizeFileName(url.searchParams.get('name') ?? '');
	if (!name) return json({ error: 'Missing or invalid file name' }, { status: 400 });

	try {
		const res = await startPrint(printer, name);
		if (!res.ok) {
			return json({ error: upstreamError(res.status, 'print') }, { status: res.status });
		}
		return json({ name });
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : 'Could not start the print' },
			{ status: 502 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	const name = sanitizeFileName(url.searchParams.get('name') ?? '');
	if (!name) return json({ error: 'Missing or invalid file name' }, { status: 400 });

	try {
		const res = await deleteFile(printer, name);
		if (!res.ok) {
			return json({ error: upstreamError(res.status, 'delete') }, { status: res.status });
		}
		return json({ name });
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : 'Could not delete the file' },
			{ status: 502 }
		);
	}
};
