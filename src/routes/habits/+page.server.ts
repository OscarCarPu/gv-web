import { habitsApi } from '$habits/api/habits.api';

export async function load() {
  const habits = await habitsApi.getDay();
  return { habits };
}
