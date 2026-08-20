import type { PageServerLoad } from './$types';
import { calendarApi } from '$lib/domains/calendar/api/calendar.api';

/**
 * Seeds the page so the first paint already has the month on it.
 *
 * The window is deliberately wider than the month grid: the server and the browser can disagree
 * about the local date by an hour, and the client refetches the exact range on mount anyway. The
 * views filter by day themselves, so extra events are harmless — a missing edge would not be.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');
	const now = new Date();
	const from = new Date(now.getFullYear(), now.getMonth(), 1);
	from.setDate(from.getDate() - 10);
	const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	to.setDate(to.getDate() + 17);

	const [calendars, events] = await Promise.all([
		calendarApi.listCalendars(token).catch((error) => {
			console.error('Failed to load calendars:', error);
			return [];
		}),
		calendarApi
			.listEvents({ from: from.toISOString(), to: to.toISOString(), visibleOnly: true }, token)
			.catch((error) => {
				console.error('Failed to load events:', error);
				return [];
			}),
	]);

	return { calendars, events };
};
