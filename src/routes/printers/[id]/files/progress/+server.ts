// Progress of the gv-web → printer leg of an in-flight upload, polled by the drop zone while
// the browser's own XHR progress has already reached 100%.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUploadProgress, sanitizeUploadId } from '$lib/server/printers/uploadProgress';

export const GET: RequestHandler = async ({ url }) => {
	const id = sanitizeUploadId(url.searchParams.get('u'));
	if (!id) return json({ error: 'Missing or invalid upload id' }, { status: 400 });

	// Unknown id means the upload has not started forwarding yet, or has already finished.
	return json(getUploadProgress(id) ?? { sent: 0, total: 0, unknown: true });
};
