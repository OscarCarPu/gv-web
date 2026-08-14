import type { RequestHandler } from './$types';
import { getPrinter } from '$lib/server/domotics/printers/config';
import { getFrame } from '$lib/server/domotics/printers/camera';

export const GET: RequestHandler = async ({ params }) => {
	const printer = getPrinter(params.id);
	if (!printer) return new Response('Printer not found', { status: 404 });

	const frame = await getFrame(printer.id, printer.rtsp);
	if (!frame) return new Response('No frame available', { status: 503 });

	return new Response(new Uint8Array(frame), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Content-Length': String(frame.length),
			'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
		},
	});
};
