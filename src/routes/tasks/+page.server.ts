import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { planApi } from '$lib/domains/tasks/api/plan.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');

	const [tasksByDueDate, activeTree, activeTimeEntry, timeEntrySummary, plan] = await Promise.all([
		tasksApi.getTasksByDueDate(token).catch((error) => {
			console.error('Failed to load tasks by due date:', error);
			return [];
		}),
		tasksApi.getActiveTree(token).catch((error) => {
			console.error('Failed to load active tree:', error);
			return [];
		}),
		tasksApi.getActiveTimeEntry(token).catch(() => null),
		tasksApi.getTimeEntrySummary(token).catch(() => ({
			today: 0,
			week: 0,
			daily_target_seconds: 0,
			weekly_target_seconds: 288000,
			pace: {
				uniform_per_day_seconds: 0,
				uniform_today_share_seconds: 0,
				weighted_weekday_seconds: 0,
				weighted_weekend_seconds: 0,
				weighted_today_share_seconds: 0,
				remaining_full_days: 0,
				goal_reached: false,
			},
		})),
		planApi.getToday(token).catch((error) => {
			console.error('Failed to load plan:', error);
			return null;
		}),
	]);

	return { tasksByDueDate, activeTree, activeTimeEntry, timeEntrySummary, plan };
};
