// Progress and outcome of the gv-web → printer leg of an upload.
//
// With `?u=<id>` it reports one upload. Without it, it lists every upload this server still
// knows about for the printer — that is how a page that was reloaded, or navigated away from and
// back, re-attaches to a transfer that is still running instead of losing sight of it.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUploadProgress,
	listUploads,
	sanitizeUploadId,
} from '$lib/server/printers/uploadProgress';

export const GET: RequestHandler = async ({ params, url }) => {
	const raw = url.searchParams.get('u');
	if (raw === null) return json({ uploads: listUploads(params.id) });

	const id = sanitizeUploadId(raw);
	if (!id) return json({ error: 'Invalid upload id' }, { status: 400 });

	// Unknown id: either it was never registered, or it settled long enough ago to be swept.
	const state = getUploadProgress(id);
	if (!state) return json({ status: 'unknown', sent: 0, total: 0 });

	return json(state);
};
