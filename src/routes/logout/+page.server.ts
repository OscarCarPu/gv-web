import { redirect, type RequestEvent } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';

export const actions = {
  default: async ({ cookies }: RequestEvent) => {
    cookies.delete('session', { path: '/' });
    cookies.delete('semiprivate', { path: '/' });
    redirect(StatusCodes.SEE_OTHER, '/login');
  }
};
