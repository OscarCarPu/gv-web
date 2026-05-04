import { habitsApi } from '$habits/api/habits.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, depends }) => {
	depends('app:habits');
	try {
		const token = cookies.get('session');
		const habits = await habitsApi.getHabits(undefined, token);
		return { habits };
	} catch (error) {
		console.error('Failed to load habits:', error);
		return { habits: [] };
	}
};
