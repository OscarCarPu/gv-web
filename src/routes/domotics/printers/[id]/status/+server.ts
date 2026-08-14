import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPrinter } from '$lib/server/domotics/printers/config';
import { fetchPrusaStatus } from '$lib/server/domotics/printers/prusalink';

export const GET: RequestHandler = async ({ params }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });

	const telemetry = await fetchPrusaStatus(printer);
	return json(telemetry);
};
