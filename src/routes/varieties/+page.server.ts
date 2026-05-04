import { varietiesApi } from '$lib/domains/varieties/api/varieties.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, depends }) => {
	depends('app:varieties');
	const token = cookies.get('session') ?? cookies.get('semiprivate');

	const varieties = await varietiesApi.listVarieties(token).catch((error) => {
		console.error('Failed to load varieties:', error);
		return [];
	});

	return { varieties };
};
