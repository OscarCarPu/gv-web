import { redirect, type Handle, json } from '@sveltejs/kit';
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

  let token = event.cookies.get('session');

  if (!token) {
    const authHeader = event.request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const validSession = token && isValidJWT(token);

  if (!validSession && !isPublicRoute) {
    const isApiRequest = pathname.startsWith('/api') ||
      event.request.headers.get('accept')?.includes('application/json');

    if (isApiRequest) {
      return json({ error: 'Unauthorized' }, { status: StatusCodes.UNAUTHORIZED });
    } else {
      redirect(StatusCodes.SEE_OTHER, '/login');
    }
  }

  if (validSession && isPublicRoute && !isAuthOnlyRoute) {
    redirect(StatusCodes.SEE_OTHER, '/habits');
  }

  const response = await resolve(event);

  const apiUrlStr = process.env.VITE_API_URL || 'http://localhost:8001';
  let apiOrigin = apiUrlStr;
  try {
    apiOrigin = new URL(apiUrlStr).origin;
  } catch (e) {
    console.warn('Invalid API URL for CSP');
  }


  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ${apiOrigin}`
  );

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
};
