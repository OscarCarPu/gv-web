import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { Verify2FAResponseSchema } from '$lib/domains/auth/schemas/auth.schemas';
import { StatusCodes } from 'http-status-codes';

export const actions = {
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
      const response = await fetch(`${env.SERVER_API_URL}/login/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: tempToken, code })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return fail(StatusCodes.BAD_REQUEST, {
          message: errorData.error || 'Invalid code'
        });
      }

      const data = await response.json();
      const { token } = Verify2FAResponseSchema.parse(data);

      cookies.set('session', token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });

      redirect(StatusCodes.SEE_OTHER, '/tasks');
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
