import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// The printers section moved under /domotics. Kept so existing bookmarks keep working.
export const load: PageLoad = () => {
	redirect(308, '/domotics/printers');
};
