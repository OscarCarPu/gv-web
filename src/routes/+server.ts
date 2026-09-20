import { redirect } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import type { RequestHandler } from './$types';

// There is no landing page: the hook already sends signed-in visitors on to /tasks or
// /domotics, so whoever reaches this is anonymous and the front door is the login.
export const GET: RequestHandler = () => {
	redirect(StatusCodes.SEE_OTHER, '/login');
};
