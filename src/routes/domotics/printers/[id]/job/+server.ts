// Job control for one printer, proxying PrusaLink.
//
//   DELETE — stop the print running right now
//
// Auth comes for free: hooks.server.ts guards every path under /domotics as semiprivate.
// Clients must send `Accept: application/json` so an expired session yields a JSON 401 rather
// than a 303 redirect to /login.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPrinter } from '$lib/server/domotics/printers/config';
import { stopCurrentJob, stopErrorMessage } from '$lib/server/domotics/printers/job';

export const DELETE: RequestHandler = async ({ params }) => {
	const printer = getPrinter(params.id);
	if (!printer) return json({ error: 'Printer not found' }, { status: 404 });
	if (!printer.prusaLinkHost) {
		return json({ error: 'PrusaLink not configured' }, { status: 503 });
	}

	try {
		const result = await stopCurrentJob(printer);
		if (result.outcome === 'idle') {
			return json({ error: 'No print is running' }, { status: 409 });
		}
		if (result.outcome === 'rejected') {
			return json({ error: stopErrorMessage(result.status) }, { status: result.status });
		}
		return json({ stopped: true });
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : 'Could not stop the print' },
			{ status: 502 }
		);
	}
};
