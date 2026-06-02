import type { PageServerLoad } from './$types';
import { fetchAPI } from '$shared/api/client';
import { RutasMarksSchema } from '$lib/domains/rutas/api/rutas.schemas';

export const load: PageServerLoad = async ({ cookies }) => {
	try {
		const token = cookies.get('session');
		const marks = await fetchAPI('/rutas/marks', RutasMarksSchema, { token });
		return { marks };
	} catch {
		return { marks: [] };
	}
};
