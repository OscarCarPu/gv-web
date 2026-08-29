import type { PageServerLoad } from './$types';
import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
import { planApi } from '$lib/domains/tasks/api/plan.api';
import { capacityApi } from '$lib/domains/capacity/api/capacity.api';
import { toLocalDateString } from '$lib/shared/utils/datetime';

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

	const freeBusyFrom = new Date();
	const freeBusyTo = new Date();
	freeBusyTo.setDate(freeBusyTo.getDate() + 7);

	const [calendars, events, planRange, freeBusy] = await Promise.all([
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
		planApi.getRange(toLocalDateString(from), toLocalDateString(to), token).catch((error) => {
			console.error('Failed to load plan range:', error);
			return { from: '', to: '', blocks: [] };
		}),
		capacityApi
			.getFreeBusy(toLocalDateString(freeBusyFrom), toLocalDateString(freeBusyTo), token)
			.catch((error) => {
				console.error('Failed to load free/busy:', error);
				return { from: '', to: '', days: [] };
			}),
	]);

	return { calendars, events, planBlocks: planRange.blocks, freeBusy };
};
