import { redirect, type Handle, json } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import { dev } from '$app/environment';
import { env } from '$lib/config/env';

const PUBLIC_ROUTES = ['/login', '/login/2fa'];
const SEMIPRIVATE_ROUTES = ['/varieties'];
const AUTH_ONLY_ROUTES = ['/logout'];

function isValidJWT(token: string): boolean {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return false;

		const payload = JSON.parse(atob(parts[1]));

		// Check expiration
		if (payload.exp) {
			const now = Math.floor(Date.now() / 1000);
			if (payload.exp < now) return false;
		}

		return true;
	} catch {
		return false;
	}
}

function matchesRoute(pathname: string, routes: string[]): boolean {
	return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	let token = event.cookies.get('session');
	if (!token) {
		const authHeader = event.request.headers.get('Authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
		}
	}
	const semiprivateToken = event.cookies.get('semiprivate');

	const validSession = !!token && isValidJWT(token);
	const validSemiprivate = !!semiprivateToken && isValidJWT(semiprivateToken);

	if (validSession) {
		event.locals.token = token;
	}
	if (validSemiprivate) {
		event.locals.semiprivateToken = semiprivateToken;
	}

	const isPublicRoute = matchesRoute(pathname, PUBLIC_ROUTES);
	const isSemiprivateRoute = matchesRoute(pathname, SEMIPRIVATE_ROUTES);
	const isAuthOnlyRoute = matchesRoute(pathname, AUTH_ONLY_ROUTES);

	const isApiRequest =
		pathname.startsWith('/api') ||
		event.request.headers.get('accept')?.includes('application/json');

	if (isAuthOnlyRoute) {
	} else if (isPublicRoute) {
		if (validSession) {
			redirect(StatusCodes.SEE_OTHER, '/tasks');
		} else if (validSemiprivate) {
			redirect(StatusCodes.SEE_OTHER, '/varieties');
		}
	} else if (isSemiprivateRoute) {
		if (!validSession && !validSemiprivate) {
			if (isApiRequest) {
				return json({ error: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
			}
			redirect(StatusCodes.SEE_OTHER, '/login');
		}
	} else {
		if (!validSession) {
			if (isApiRequest) {
				return json({ error: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
			}
			redirect(StatusCodes.SEE_OTHER, '/login');
		}
	}

	const response = await resolve(event);

	let apiOrigin = env.API_URL;
	try {
		apiOrigin = new URL(env.API_URL).origin;
	} catch (e) {
		console.warn('Invalid API URL for CSP');
	}

	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// 'unsafe-eval' is required in production because Zod v4 probes for
	// Function constructor support (JIT compilation check) at module load time.
	const scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval'";
	response.headers.set(
		'Content-Security-Policy',
		`default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ${apiOrigin}`
	);

	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
