import { reportApi } from '$lib/domains/report/api/report.api';
import type { ReportItem, ReportStatus } from '$lib/domains/report/api/report.schemas';
import { hasContent } from '$lib/domains/report/utils/hasContent';
import { addToast } from '$shared/stores/toast.svelte';

export interface ReportApi {
	status: () => Promise<ReportStatus>;
	dismiss: () => Promise<void>;
}

export type ReportView = 'waiting' | 'running' | 'failed' | 'report' | 'none';

const idle: ReportStatus = { mode: 'normal', merge: '', report: null };

/** Owns the report page: the server's status and the polling that keeps it fresh. */
export class ReportScreen {
	#api: ReportApi;
	#status = $state<ReportStatus>(idle);
	#busy = $state(false);
	#timer: ReturnType<typeof setInterval> | undefined;

	constructor(initial: ReportStatus | null, api: ReportApi = reportApi) {
		this.#api = api;
		if (initial) this.#status = initial;
	}

	get items(): ReportItem[] {
		return this.#status.report?.items ?? [];
	}

	get skipped(): string[] {
		return this.#status.report?.skipped ?? [];
	}

	get error(): string | undefined {
		return this.#status.error;
	}

	get reportError(): string | undefined {
		return this.#status.report?.error;
	}

	get busy(): boolean {
		return this.#busy;
	}

	get view(): ReportView {
		if (this.#status.mode !== 'normal') {
			if (this.#status.merge === 'failed') return 'failed';
			return this.#status.merge === 'running' ? 'running' : 'waiting';
		}
		return hasContent(this.#status.report) ? 'report' : 'none';
	}

	async refresh(): Promise<void> {
		try {
			this.#status = await this.#api.status();
		} catch {
			// the API restarts while the databases are swapped; the next tick asks again
		}
	}

	async dismiss(): Promise<boolean> {
		if (this.#busy) return false;
		this.#busy = true;
		try {
			await this.#api.dismiss();
			await this.refresh();
			return true;
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not dismiss the report', 'error');
			return false;
		} finally {
			this.#busy = false;
		}
	}

	start(intervalMs = 3000): void {
		this.stop();
		this.#timer = setInterval(() => {
			if (this.#status.mode !== 'normal') void this.refresh();
		}, intervalMs);
	}

	stop(): void {
		clearInterval(this.#timer);
		this.#timer = undefined;
	}
}
