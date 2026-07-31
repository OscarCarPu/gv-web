import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TimeEntriesApi } from '$lib/domains/tasks/timeEntries.svelte';
import type {
	TimeEntrySummaryResponse,
	TimeEntryWithTask,
} from '$lib/domains/tasks/types/Task.types';

const SUMMARY = {
	today: 0,
	week: 0,
	daily_target_seconds: 3600,
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
} as TimeEntrySummaryResponse;

let entryId = 0;
function makeEntry(over: Partial<TimeEntryWithTask> = {}): TimeEntryWithTask {
	return {
		id: ++entryId,
		task_id: 1,
		task_name: 'Task',
		task_type: 'standard',
		recurrence: null,
		priority: 3,
		project_id: null,
		project_name: null,
		started_at: new Date().toISOString(),
		finished_at: new Date().toISOString(),
		comment: null,
		task_finished_at: null,
		time_spent: 3600,
		...over,
	};
}

/** Per-key `vi.fn()` types so `.mockResolvedValue` / `.mock.calls` stay visible to the checker. */
function createMockApi(): {
	createTimeEntry: ReturnType<typeof vi.fn>;
	updateTimeEntry: ReturnType<typeof vi.fn>;
	deleteTimeEntry: ReturnType<typeof vi.fn>;
	getTimeEntries: ReturnType<typeof vi.fn>;
	getTimeEntrySummary: ReturnType<typeof vi.fn>;
	getTimeEntryHistory: ReturnType<typeof vi.fn>;
} {
	return {
		createTimeEntry: vi.fn().mockResolvedValue({ id: 42 }),
		updateTimeEntry: vi.fn().mockResolvedValue({ id: 42 }),
		deleteTimeEntry: vi.fn().mockResolvedValue(undefined),
		getTimeEntries: vi.fn().mockResolvedValue([]),
		getTimeEntrySummary: vi.fn().mockResolvedValue({ ...SUMMARY, today: 3600 }),
		getTimeEntryHistory: vi.fn().mockResolvedValue({ start_at: '', end_at: '', data: [] }),
	};
}

/** The mock satisfies the real interface; cast at the call site to keep the mock types above. */
const asApi = (m: ReturnType<typeof createMockApi>) => m as unknown as TimeEntriesApi;

describe('TimeEntries', () => {
	let TimeEntries: typeof import('$lib/domains/tasks/timeEntries.svelte').TimeEntries;
	let api: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
		({ TimeEntries } = await import('$lib/domains/tasks/timeEntries.svelte'));
		api = createMockApi();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('SSR fallback', () => {
		it('reads today and summary from the SSR getters before any fetch', () => {
			const ssrToday = [makeEntry()];
			const store = new TimeEntries(asApi(api), { today: () => ssrToday, summary: () => SUMMARY });

			expect(store.today).toBe(ssrToday);
			expect(store.summary).toBe(SUMMARY);
			expect(api.getTimeEntries).not.toHaveBeenCalled();
		});

		it('returns sane empties with no SSR getters at all', () => {
			const store = new TimeEntries(asApi(api));
			expect(store.today).toEqual([]);
			expect(store.summary).toBeNull();
		});

		it('lets a client fetch supersede the SSR payload', async () => {
			const fresh = [makeEntry({ id: 900 })];
			api.getTimeEntries.mockResolvedValue(fresh);
			const store = new TimeEntries(asApi(api), { today: () => [makeEntry({ id: 1 })] });

			await store.loadToday();
			// toEqual, not toBe: `$state` hands back a reactive proxy of the fetched array.
			expect(store.today).toEqual(fresh);
		});

		it('keeps the last good snapshot when loadToday fails', async () => {
			const ssrToday = [makeEntry()];
			api.getTimeEntries.mockRejectedValue(new Error('offline'));
			const store = new TimeEntries(asApi(api), { today: () => ssrToday });

			await store.loadToday();
			expect(store.today).toBe(ssrToday);
		});
	});

	describe('mutations re-sync derived data', () => {
		it('refreshes the summary and today after create', async () => {
			const store = new TimeEntries(asApi(api));
			await store.create({ task_id: 1, started_at: new Date().toISOString() });

			expect(api.createTimeEntry).toHaveBeenCalledOnce();
			expect(api.getTimeEntrySummary).toHaveBeenCalledOnce();
			expect(api.getTimeEntries).toHaveBeenCalledOnce();
			expect(store.summary?.today).toBe(3600);
		});

		it('refreshes the summary and today after update', async () => {
			const store = new TimeEntries(asApi(api));
			await store.update(7, { comment: 'x' });

			expect(api.updateTimeEntry).toHaveBeenCalledWith(7, { comment: 'x' });
			expect(api.getTimeEntrySummary).toHaveBeenCalledOnce();
			expect(store.summary?.today).toBe(3600);
		});

		it('refreshes the summary and today after remove', async () => {
			const store = new TimeEntries(asApi(api));
			await store.remove(7);

			expect(api.deleteTimeEntry).toHaveBeenCalledWith(7);
			expect(api.getTimeEntrySummary).toHaveBeenCalledOnce();
		});

		it('does not refetch the agenda window while it has never been loaded', async () => {
			const store = new TimeEntries(asApi(api));
			await store.remove(7);
			// Only today's fetch — no second call for the never-opened agenda sheet.
			expect(api.getTimeEntries).toHaveBeenCalledOnce();
		});

		it('does refetch the agenda window once it holds entries', async () => {
			api.getTimeEntries.mockResolvedValue([makeEntry()]);
			const store = new TimeEntries(asApi(api));
			await store.loadWindow();
			api.getTimeEntries.mockClear();

			await store.remove(7);
			// Once for today, once for the open window.
			expect(api.getTimeEntries).toHaveBeenCalledTimes(2);
		});

		it('survives a failing summary refresh without rejecting the mutation', async () => {
			api.getTimeEntrySummary.mockRejectedValue(new Error('boom'));
			const store = new TimeEntries(asApi(api));
			await expect(store.remove(7)).resolves.toBeUndefined();
		});
	});

	describe('loadWindow', () => {
		it('drops entries that finished before the rolling 24h window', async () => {
			const inWindow = makeEntry({
				started_at: new Date(2026, 6, 15, 9, 0).toISOString(),
				finished_at: new Date(2026, 6, 15, 10, 0).toISOString(),
			});
			const tooOld = makeEntry({
				started_at: new Date(2026, 6, 13, 9, 0).toISOString(),
				finished_at: new Date(2026, 6, 13, 10, 0).toISOString(),
			});
			api.getTimeEntries.mockResolvedValue([inWindow, tooOld]);

			const store = new TimeEntries(asApi(api));
			await store.loadWindow();

			expect(store.entries).toEqual([inWindow]);
			expect(store.loading).toBe(false);
		});

		it('keeps a still-running entry regardless of when it started', async () => {
			const running = makeEntry({
				started_at: new Date(2026, 6, 10, 9, 0).toISOString(),
				finished_at: null,
			});
			api.getTimeEntries.mockResolvedValue([running]);

			const store = new TimeEntries(asApi(api));
			await store.loadWindow();
			expect(store.entries).toEqual([running]);
		});

		it('widens the request to a week in week mode', async () => {
			const store = new TimeEntries(asApi(api));
			store.toggleMode();
			expect(store.mode).toBe('week');

			await store.loadWindow();
			// 15 July minus 7 days.
			expect(api.getTimeEntries).toHaveBeenCalledWith({ start_time: '2026-07-08' });
		});

		it('empties the list and clears loading on failure', async () => {
			api.getTimeEntries.mockRejectedValue(new Error('offline'));
			const store = new TimeEntries(asApi(api));
			await store.loadWindow();

			expect(store.entries).toEqual([]);
			expect(store.loading).toBe(false);
		});
	});

	describe('secondsForTask', () => {
		it('sums only the requested task, counting a running entry up to now', () => {
			const store = new TimeEntries(asApi(api), {
				today: () => [
					makeEntry({
						task_id: 1,
						started_at: new Date(2026, 6, 15, 9, 0).toISOString(),
						finished_at: new Date(2026, 6, 15, 10, 0).toISOString(),
					}),
					makeEntry({
						task_id: 1,
						started_at: new Date(2026, 6, 15, 11, 30).toISOString(),
						finished_at: null,
					}),
					makeEntry({
						task_id: 2,
						started_at: new Date(2026, 6, 15, 8, 0).toISOString(),
						finished_at: new Date(2026, 6, 15, 8, 30).toISOString(),
					}),
				],
			});

			// 1h finished + 30m still running at 12:00.
			expect(store.secondsForTask(1)).toBe(5400);
			expect(store.secondsForTask(2)).toBe(1800);
			expect(store.secondsForTask(999)).toBe(0);
		});
	});

	describe('retimeToday', () => {
		it('turns an HH:MM range into ISO bounds on today and writes them', async () => {
			const store = new TimeEntries(asApi(api));
			await store.retimeToday(11, { start: '09:15', end: '10:45' }, 'notes');

			const [id, body] = api.updateTimeEntry.mock.calls[0];
			expect(id).toBe(11);
			expect(new Date(body.started_at as string)).toEqual(new Date(2026, 6, 15, 9, 15));
			expect(new Date(body.finished_at as string)).toEqual(new Date(2026, 6, 15, 10, 45));
			expect(body.comment).toBe('notes');
		});

		it('normalises an empty comment to null', async () => {
			const store = new TimeEntries(asApi(api));
			await store.retimeToday(11, { start: '09:00', end: '10:00' }, '');
			expect(api.updateTimeEntry.mock.calls[0][1].comment).toBeNull();
		});

		it('writes nothing when the range is unparseable', async () => {
			const store = new TimeEntries(asApi(api));
			await store.retimeToday(11, { start: '', end: '10:00' }, null);
			await store.retimeToday(11, { start: 'nope', end: '10:00' }, null);
			expect(api.updateTimeEntry).not.toHaveBeenCalled();
		});
	});

	describe('TaskTimerApi adapter', () => {
		it('passes the three timer writes straight through without a re-sync', async () => {
			const store = new TimeEntries(asApi(api));

			await store.createTimeEntry({ task_id: 1, started_at: 'x' });
			await store.updateTimeEntry(2, { comment: 'c' });
			await store.deleteTimeEntry(3);

			expect(api.createTimeEntry).toHaveBeenCalledOnce();
			expect(api.updateTimeEntry).toHaveBeenCalledWith(2, { comment: 'c' });
			expect(api.deleteTimeEntry).toHaveBeenCalledWith(3);
			// The hot path must stay quiet — the page refreshes once the clock settles.
			expect(api.getTimeEntrySummary).not.toHaveBeenCalled();
			expect(api.getTimeEntries).not.toHaveBeenCalled();
		});
	});
});
