import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { toLocalDateString } from '$lib/shared/utils/datetime';
import { buildAgendaItems, type AgendaItem } from '$lib/domains/tasks/utils/agendaTimeline';
import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

export interface AgendaApi {
	getTimeEntries: (params: {
		start_time: string;
		end_time?: string;
	}) => Promise<TimeEntryWithTask[]>;
}

/**
 * Owns the Agenda right-sheet's state: the `day`/`week` window mode, the fetched entries,
 * and the loading flag. The component keeps only its open `$effect` that calls `load()`.
 * Mirrors the controller style: injected `#api`, `$state` read directly by the template,
 * the timeline derivation exposed as a `get` accessor.
 */
export class Agenda {
	#api: AgendaApi;

	entries = $state<TimeEntryWithTask[]>([]);
	loading = $state(false);
	mode = $state<'day' | 'week'>('day');

	constructor(api: AgendaApi = tasksApi) {
		this.#api = api;
	}

	#getTimeWindow(): { start: Date; end: Date } {
		const now = new Date();
		const hours = this.mode === 'day' ? 24 : 24 * 7;
		const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
		return { start, end: now };
	}

	get items(): AgendaItem[] {
		return buildAgendaItems(this.entries);
	}

	toggleMode(): void {
		this.mode = this.mode === 'day' ? 'week' : 'day';
	}

	async load(): Promise<void> {
		this.loading = true;
		try {
			const window = this.#getTimeWindow();
			const result = await this.#api.getTimeEntries({
				start_time: toLocalDateString(window.start),
			});
			const windowStartMs = window.start.getTime();
			this.entries = result.filter((e) => {
				const endMs = e.finished_at ? new Date(e.finished_at).getTime() : Date.now();
				return endMs >= windowStartMs;
			});
		} catch {
			this.entries = [];
		} finally {
			this.loading = false;
		}
	}
}
