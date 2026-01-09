import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { LoginResponseSchema, Verify2FAResponseSchema } from '$lib/domains/auth/schemas/auth.schemas';
import { StatusCodes } from 'http-status-codes';

export const actions = {
  login: async ({ request, fetch }: RequestEvent) => {
    const formData = await request.formData();
    const password = formData.get('password');

    if (!password || typeof password !== 'string') {
      return fail(StatusCodes.BAD_REQUEST, { message: 'Password is required' });
    }

    try {
      const response = await fetch(`${env.API_URL}/login?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: {
          'X-API-Key': env.API_KEY
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return fail(StatusCodes.UNAUTHORIZED, {
          message: errorData.detail || 'Invalid password'
        });
      }

      const data = await response.json();
      const { temp_token } = LoginResponseSchema.parse(data);

      redirect(StatusCodes.SEE_OTHER, `/login/2fa?token=${temp_token}`);
    } catch (error) {
      if (error instanceof Response || (error as { status?: number })?.status === StatusCodes.SEE_OTHER) {
        throw error;
      }
      return fail(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'An unexpected error occurred'
      });
    }
  },

  verify2fa: async ({ request, fetch, cookies }: RequestEvent) => {
    const formData = await request.formData();
    const code = formData.get('code');
    const tempToken = formData.get('temp_token');

    if (!code || typeof code !== 'string') {
      return fail(StatusCodes.BAD_REQUEST, { message: 'Code is required' });
    }

    if (!tempToken || typeof tempToken !== 'string') {
      return fail(StatusCodes.BAD_REQUEST, { message: 'Invalid session' });
    }

    try {
      const params = new URLSearchParams({
        code,
        temp_token: tempToken
      });
      const response = await fetch(`${env.API_URL}/verify-2fa?${params}`, {
        method: 'POST',
        headers: {
          'X-API-Key': env.API_KEY
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return fail(StatusCodes.BAD_REQUEST, {
          message: errorData.detail || 'Invalid code'
        });
      }

      const data = await response.json();
      const { access_token } = Verify2FAResponseSchema.parse(data);

      cookies.set('session', access_token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 1 day
      });

      redirect(StatusCodes.SEE_OTHER, '/habits');
    } catch (error) {
      if (error instanceof Response || (error as { status?: number })?.status === StatusCodes.SEE_OTHER) {
        throw error;
      }
      return fail(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'An unexpected error occurred'
      });
    }
  }
};
