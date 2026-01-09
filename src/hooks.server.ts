import { redirect, type Handle } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';

const PUBLIC_ROUTES = ['/login', '/login/2fa'];
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

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  const session = event.cookies.get('session');

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Validate JWT if session exists
  if (session && !isValidJWT(session)) {
    // Invalid or expired token - delete and redirect to login
    event.cookies.delete('session', { path: '/' });
    if (!isPublicRoute) {
      redirect(StatusCodes.SEE_OTHER, '/login');
    }
  }

  const validSession = session && isValidJWT(session);

  if (!validSession && !isPublicRoute) {
    redirect(StatusCodes.SEE_OTHER, '/login');
  }

  if (validSession && isPublicRoute && !isAuthOnlyRoute) {
    redirect(StatusCodes.SEE_OTHER, '/habits');
  }

  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' " + (process.env.VITE_API_URL || 'http://localhost:8001')
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
};
