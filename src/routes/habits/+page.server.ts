import { habitsApi } from '$habits/api/habits.api';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export async function load() {
  const habits = await habitsApi.getDay();
  return { habits };
}

export const actions: Actions = {
  toggleBoolean: async ({ request }) => {
    const formData = await request.formData();
    const habitId = Number(formData.get('habitId'));
    const logDate = String(formData.get('logDate'));
    const currentValue = formData.get('currentValue') === '1';

    const newValue = currentValue ? '0' : '1';

    if (!habitId || !logDate) {
      return fail(400, { error: 'Missing required fields' });
    }

    try {
      await habitsApi.upsertLog(habitId, {
        log_date: logDate,
        value: newValue
      });

      return { success: true };
    } catch (error) {
      return fail(500, { error: 'Failed to toggle habit' });
    }
  }
};
