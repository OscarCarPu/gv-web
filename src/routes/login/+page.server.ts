import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { LoginResponseSchema } from '$lib/domains/auth/schemas/auth.schemas';
import { StatusCodes } from 'http-status-codes';

export const actions = {
  login: async ({ request, fetch, cookies }: RequestEvent) => {
    const formData = await request.formData();
    const password = formData.get('password');

    if (!password || typeof password !== 'string') {
      return fail(StatusCodes.BAD_REQUEST, { message: 'Password is required' });
    }

    try {
      const response = await fetch(`${env.SERVER_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return fail(StatusCodes.UNAUTHORIZED, {
          message: errorData.error || 'Invalid password'
        });
      }

      const data = await response.json();
      const { token, kind } = LoginResponseSchema.parse(data);

      if (kind === 'semi') {
        cookies.set('semiprivate', token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 30
        });
        redirect(StatusCodes.SEE_OTHER, '/weed');
      }

      redirect(StatusCodes.SEE_OTHER, `/login/2fa?token=${token}`);
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
