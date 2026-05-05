import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const token = cookies.get('session');
	const id = Number(params.id);

	const projectChildren = await tasksApi.getProjectChildren(id, token).catch((error) => {
		console.error('Failed to load project children:', error);
		return null;
	});

	return { projectChildren };
};
