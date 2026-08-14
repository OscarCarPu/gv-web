import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// /domotics is only a shell — land on the first tab.
export const load: PageLoad = () => {
	redirect(307, '/domotics/printers');
};
