import { redirect, type RequestEvent } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';

export const actions = {
  default: async ({ cookies }: RequestEvent) => {
    cookies.delete('session', { path: '/' });
    redirect(StatusCodes.SEE_OTHER, '/login');
  }
};
