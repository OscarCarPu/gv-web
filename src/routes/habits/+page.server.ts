import { habitsApi } from '$habits/api/habits.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  try {
    const habits = await habitsApi.getHabits();
    return { habits };
  } catch (error) {
    console.error('Failed to load habits:', error);
    return { habits: [] };
  }
};
