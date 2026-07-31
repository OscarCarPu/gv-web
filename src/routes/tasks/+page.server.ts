import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { planApi } from '$lib/domains/tasks/api/plan.api';
import { toLocalDateString } from '$lib/shared/utils/datetime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');

	const [tasksByDueDate, activeTree, activeTimeEntry, timeEntrySummary, plan, todayTimeEntries] =
		await Promise.all([
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
			// Today's real time entries — Today's Plan renders its past half from these, so they
			// ship with the SSR payload to avoid a blank "What I did" on first paint.
			tasksApi.getTimeEntries({ start_time: toLocalDateString() }, token).catch((error) => {
				console.error("Failed to load today's time entries:", error);
				return [];
			}),
		]);

	return {
		tasksByDueDate,
		activeTree,
		activeTimeEntry,
		timeEntrySummary,
		plan,
		todayTimeEntries,
	};
};
