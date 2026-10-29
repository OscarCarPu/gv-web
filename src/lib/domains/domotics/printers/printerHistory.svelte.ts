import { apiFetch } from '$shared/api/client';
import { PrintHistorySchema, type PrintHistoryEntry } from './api/printers.schemas';

// Controller for the print history list. The history lives in Prusa Connect, so this only reads it;
// a slow poll picks up a print that finished while the page was open.

const POLL_MS = 60_000;

export class PrinterHistoryController {
	readonly id: string;
	jobs = $state<PrintHistoryEntry[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(id: string) {
		this.id = id;
	}

	async refresh(): Promise<void> {
		try {
			const res = await apiFetch(`/domotics/printers/${this.id}/history`, {
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			this.jobs = PrintHistorySchema.parse(body);
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Could not load the history';
		} finally {
			this.loading = false;
		}
	}

	start() {
		void this.refresh();
		this.timer = setInterval(() => void this.refresh(), POLL_MS);
	}

	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
