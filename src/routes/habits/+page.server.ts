import { habitsApi } from '$habits/api/habits.api';
import { setServerToken } from '$shared/stores/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const token = cookies.get('session');
  setServerToken(token);

  const habits = await habitsApi.getDay();
  return { habits, token };
};
