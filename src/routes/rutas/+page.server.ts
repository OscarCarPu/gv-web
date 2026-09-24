import type { PageServerLoad } from './$types';
import { fetchAPI } from '$shared/api/client';
import { RutasMarksSchema } from '$lib/domains/rutas/api/rutas.schemas';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		// Semiprivate route: either tier's token gets in.
		const token = locals.token ?? locals.semiprivateToken;
		const marks = await fetchAPI('/rutas/marks', RutasMarksSchema, { token });
		return { marks };
	} catch {
		return { marks: [] };
	}
};
