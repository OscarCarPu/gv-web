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
import { getPrinter } from '$lib/server/domotics/printers/config';
import {
	bodySizeLimitError,
	deleteFile,
	fetchFiles,
	sanitizeFileName,
	startPrint,
	uploadFile,
} from '$lib/server/domotics/printers/files';
import {
	finishUpload,
	sanitizeUploadId,
	setUploadProgress,
	startUpload,
} from '$lib/server/domotics/printers/uploadProgress';

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

	// Forwarding to the printer takes as long as the printer takes, so it must NOT happen inside
	// this request: holding the response open for it is what got a 62 MB upload killed by the
	// Cloudflare tunnel at ~100s (524). Reply as soon as the bytes are in, then forward in the
	// background while the browser polls ./progress for the percentage and the outcome.
	const uploadId = sanitizeUploadId(request.headers.get('x-upload-id')) ?? crypto.randomUUID();
	const overwrite = url.searchParams.get('overwrite') === '1';
	startUpload(uploadId, params.id, name, body.byteLength);

	void uploadFile(printer, name, body, overwrite, (sent) => setUploadProgress(uploadId, sent))
		.then(async (res) => {
			if (res.ok) {
				finishUpload(uploadId, { ok: true });
				return;
			}
			await res.arrayBuffer().catch(() => {}); // release the connection
			finishUpload(uploadId, {
				ok: false,
				error: upstreamError(res.status, 'upload'),
				httpStatus: res.status,
			});
		})
		.catch((e) => {
			finishUpload(uploadId, {
				ok: false,
				error: e instanceof Error ? e.message : 'Upload to the printer failed',
				httpStatus: 502,
			});
		});

	// 202: accepted by gv-web, not yet on the printer.
	return json({ name, uploadId }, { status: 202 });
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
