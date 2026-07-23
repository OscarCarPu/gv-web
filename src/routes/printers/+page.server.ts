import type { PageServerLoad } from './$types';
import { listPrinters } from '$lib/server/printers/config';

export const load: PageServerLoad = async () => {
	return { printers: listPrinters() };
};
