import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { toLocalDateString } from '$lib/shared/utils/datetime';
import { buildAgendaItems, type AgendaItem } from '$lib/domains/tasks/utils/agendaTimeline';
import type {
	CreateTimeEntryRequest,
	UpdateTimeEntryRequest,
	TimeEntryResponse,
	TimeEntrySummaryResponse,
	TimeEntryHistoryResponse,
	TimeEntryWithTask,
} from '$lib/domains/tasks/types/Task.types';

/** Every network call the time-entry domain is allowed to make. Injected so tests can fake it. */
export interface TimeEntriesApi {
	createTimeEntry: (input: CreateTimeEntryRequest) => Promise<TimeEntryResponse>;
	updateTimeEntry: (id: number, input: UpdateTimeEntryRequest) => Promise<TimeEntryResponse>;
	deleteTimeEntry: (id: number) => Promise<void>;
	getTimeEntries: (params: {
		start_time: string;
		end_time?: string;
	}) => Promise<TimeEntryWithTask[]>;
	getTimeEntrySummary: () => Promise<TimeEntrySummaryResponse>;
	getTimeEntryHistory: (params: {
		frequency: string;
		start_at?: string;
		end_at?: string;
	}) => Promise<TimeEntryHistoryResponse>;
}

export type AgendaMode = 'day' | 'week';

/**
 * Getters onto the page's SSR payload. Reads fall back to these until a client fetch or a
 * mutation produces something newer, which is what makes the store correct during SSR (where
 * `$effect` never runs) without the page having to seed it imperatively.
 */
export interface TimeEntriesSSR {
	today?: () => TimeEntryWithTask[];
	summary?: () => TimeEntrySummaryResponse;
}

/**
 * The single owner of every time-entry operation in the app.
 *
 * Before this existed the same three `tasksApi` calls were made from six places
 * (`TaskTimer`, the tasks page's manual-add, `TimeEntryBottomSheet`, `Agenda`,
 * `TimeHistoryModal`, `TaskBoard.refreshSummary`), each with its own loading flag and its
 * own idea of when the summary needed refetching. Everything now funnels through here:
 *
 *   - **mutations** (`create` / `update` / `remove`) transparently refresh the summary and
 *     any loaded window, so callers never have to remember to re-sync;
 *   - **reads** (`loadWindow` / `loadToday` / `history`) own their own loading flags;
 *   - **derived** views (`agendaItems`, `todayEntries`, `secondsForTask`) are getters, so
 *     they recompute from `entries` without extra plumbing.
 *
 * `TaskTimer` still owns the *ticking* clock (that's UI state, not persistence) but delegates
 * all four of its writes here, which is why this class satisfies `TaskTimerApi` structurally.
 */
export class TimeEntries {
	#api: TimeEntriesApi;
	#ssr: TimeEntriesSSR;

	/** Entries for the currently loaded window, newest-first as the API returns them. */
	entries = $state<TimeEntryWithTask[]>([]);
	loading = $state(false);
	mode = $state<AgendaMode>('day');

	// Client-fetched values shadow the SSR payload once present. Same shape as
	// `TaskBoard`'s old summary override, which this replaces.
	#todayOverride = $state<TimeEntryWithTask[] | null>(null);
	#summaryOverride = $state<TimeEntrySummaryResponse | null>(null);

	constructor(api: TimeEntriesApi = tasksApi, ssr: TimeEntriesSSR = {}) {
		this.#api = api;
		this.#ssr = ssr;
	}

	// ── derived views ──────────────────────────────────────────────────

	/** Today's entries (local day). Drives the plan overlay; kept apart from `entries` so an
	 *  agenda window switch can never clobber it. */
	get today(): TimeEntryWithTask[] {
		return this.#todayOverride ?? this.#ssr.today?.() ?? [];
	}

	get summary(): TimeEntrySummaryResponse | null {
		return this.#summaryOverride ?? this.#ssr.summary?.() ?? null;
	}

	get agendaItems(): AgendaItem[] {
		return buildAgendaItems(this.entries);
	}

	/** Seconds logged today against one task (running entries counted up to now). */
	secondsForTask(taskId: number, nowMs: number = Date.now()): number {
		let total = 0;
		for (const e of this.today) {
			if (e.task_id !== taskId) continue;
			const start = new Date(e.started_at).getTime();
			const end = e.finished_at ? new Date(e.finished_at).getTime() : nowMs;
			total += Math.max(0, (end - start) / 1000);
		}
		return total;
	}

	// ── reads ──────────────────────────────────────────────────────────

	/** Load today's entries (local day) for the plan overlay. */
	async loadToday(): Promise<void> {
		try {
			this.#todayOverride = await this.#api.getTimeEntries({ start_time: toLocalDateString() });
		} catch {
			// Keep the previous snapshot rather than blanking the overlay on a transient failure.
		}
	}

	/**
	 * Load the agenda window implied by `mode` (last 24h / last 7d). The API works in whole
	 * days, so entries that finished before the rolling window start are dropped client-side.
	 */
	async loadWindow(): Promise<void> {
		this.loading = true;
		try {
			const now = Date.now();
			const hours = this.mode === 'day' ? 24 : 24 * 7;
			const startMs = now - hours * 60 * 60 * 1000;
			const result = await this.#api.getTimeEntries({
				start_time: toLocalDateString(new Date(startMs)),
			});
			this.entries = result.filter((e) => {
				const endMs = e.finished_at ? new Date(e.finished_at).getTime() : now;
				return endMs >= startMs;
			});
		} catch {
			this.entries = [];
		} finally {
			this.loading = false;
		}
	}

	toggleMode(): void {
		this.mode = this.mode === 'day' ? 'week' : 'day';
	}

	async refreshSummary(): Promise<void> {
		this.#summaryOverride = await this.#api.getTimeEntrySummary();
	}

	history(params: {
		frequency: string;
		start_at?: string;
		end_at?: string;
	}): Promise<TimeEntryHistoryResponse> {
		return this.#api.getTimeEntryHistory(params);
	}

	// ── mutations (each re-syncs derived data) ─────────────────────────

	/**
	 * Re-fetch whatever is currently loaded. `entries` is only refetched when a window has
	 * actually been loaded, so the agenda sheet staying closed costs nothing. Mutations call
	 * this for you; callers only need it after the timer's own start/stop writes.
	 */
	async refresh(): Promise<void> {
		await Promise.all([
			this.refreshSummary().catch(() => {}),
			this.loadToday(),
			this.entries.length > 0 ? this.loadWindow() : Promise.resolve(),
		]);
	}

	async create(input: CreateTimeEntryRequest): Promise<TimeEntryResponse> {
		const entry = await this.#api.createTimeEntry(input);
		await this.refresh();
		return entry;
	}

	async update(id: number, input: UpdateTimeEntryRequest): Promise<TimeEntryResponse> {
		const entry = await this.#api.updateTimeEntry(id, input);
		await this.refresh();
		return entry;
	}

	async remove(id: number): Promise<void> {
		await this.#api.deleteTimeEntry(id);
		await this.refresh();
	}

	/**
	 * Retime an entry to an explicit `HH:MM`–`HH:MM` pair on today's date. Used by the timer
	 * panel's manual add, which retimes the *running* entry (and thereby closes it) rather
	 * than creating a separate one.
	 */
	async retimeToday(
		id: number,
		range: { start: string; end: string },
		comment: string | null
	): Promise<void> {
		const bounds = TimeEntries.todayRangeToISO(range);
		if (!bounds) return;
		await this.update(id, {
			started_at: bounds.started_at,
			finished_at: bounds.finished_at,
			comment: comment || null,
		});
	}

	/** `{start:'10:00', end:'11:00'}` → ISO bounds on today's date, or null if unparseable. */
	static todayRangeToISO(range: {
		start: string;
		end: string;
	}): { started_at: string; finished_at: string } | null {
		if (!range.start || !range.end) return null;
		const [sh, sm] = range.start.split(':').map(Number);
		const [eh, em] = range.end.split(':').map(Number);
		if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
		const today = new Date();
		const at = (h: number, m: number) =>
			new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0);
		return {
			started_at: at(sh, sm).toISOString(),
			finished_at: at(eh, em).toISOString(),
		};
	}

	// ── TaskTimerApi adapter ───────────────────────────────────────────
	// TaskTimer writes through these three names. They deliberately skip `#resync` on the
	// hot path — the timer's start/stop flow refreshes explicitly once the clock settles,
	// and re-fetching on every keystroke-debounced comment write would be wasteful.

	createTimeEntry(input: CreateTimeEntryRequest): Promise<TimeEntryResponse> {
		return this.#api.createTimeEntry(input);
	}

	updateTimeEntry(id: number, input: UpdateTimeEntryRequest): Promise<TimeEntryResponse> {
		return this.#api.updateTimeEntry(id, input);
	}

	deleteTimeEntry(id: number): Promise<void> {
		return this.#api.deleteTimeEntry(id);
	}
}
