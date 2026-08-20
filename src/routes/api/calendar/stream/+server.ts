import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';

/**
 * Proxies the API's change stream so the browser can listen to it.
 *
 * The API authenticates with a bearer token and the browser's `EventSource` cannot set headers,
 * so the alternative would be putting the token in a query string — where it ends up in logs and
 * history. Here the token never leaves the server: it lives in `locals` (from the httpOnly
 * cookie) and is attached on this hop.
 *
 * The upstream body is passed through untouched, so the API's own keep-alive comments are what
 * hold the connection open.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	if (!locals.token) {
		return new Response('unauthorized', { status: 401 });
	}

	let upstream: Response;
	try {
		upstream = await fetch(`${env.SERVER_API_URL}/calendar/stream`, {
			headers: { Authorization: `Bearer ${locals.token}`, Accept: 'text/event-stream' },
			// Closing the browser tab has to close the upstream connection too, or every reload
			// leaks a subscription on the API.
			signal: request.signal,
		});
	} catch {
		return new Response('calendar api unreachable', { status: 502 });
	}

	if (!upstream.ok || !upstream.body) {
		return new Response('calendar stream unavailable', { status: upstream.status || 502 });
	}

	return new Response(upstream.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
};
