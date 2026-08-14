import type { PageServerLoad } from './$types';
import { listPrinters } from '$lib/server/domotics/printers/config';

export const load: PageServerLoad = async () => {
	return { printers: listPrinters() };
};
