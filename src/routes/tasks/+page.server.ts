import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const token = cookies.get('session');

  const [tasksByDueDate, activeTree, activeTimeEntry] = await Promise.all([
    tasksApi.getTasksByDueDate(token).catch((error) => {
      console.error('Failed to load tasks by due date:', error);
      return [];
    }),
    tasksApi.getActiveTree(token).catch((error) => {
      console.error('Failed to load active tree:', error);
      return [];
    }),
    tasksApi.getActiveTimeEntry(token).catch(() => null)
  ]);

  return { tasksByDueDate, activeTree, activeTimeEntry };
};
