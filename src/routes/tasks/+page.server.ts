import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  try {
    const token = cookies.get('session');
    const tasksByDueDate = await tasksApi.getTasksByDueDate(token);
    return { tasksByDueDate };
  } catch (error) {
    console.error('Failed to load tasks by due date:', error);
    return { tasksByDueDate: [] };
  }
};
