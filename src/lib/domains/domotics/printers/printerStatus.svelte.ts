import { addToast } from '$shared/stores/toast.svelte';
import { TelemetrySchema, type Telemetry } from './api/printers.schemas';

// Controller for a single printer view: polls telemetry on an interval and
// exposes reactive state. The camera feed is driven separately by the component
// (a plain <img> refresh loop) to keep the image path off the JSON poll.

/**
 * States in which the printer has a job that stopping applies to. FINISHED and STOPPED are
 * deliberately absent: the job is over, and the printer answers 409 for those anyway.
 */
const STOPPABLE_STATES = ['PRINTING', 'PAUSED', 'ATTENTION'];

/** Exported for unit tests. */
export function isStoppableState(state?: string): boolean {
	return STOPPABLE_STATES.includes((state ?? '').toUpperCase());
}

export class PrinterController {
	readonly id: string;
	telemetry = $state<Telemetry | null>(null);
	error = $state<string | null>(null);
	/** Set while a stop request is in flight, so the button cannot be double-fired. */
	stopping = $state(false);
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(id: string) {
		this.id = id;
	}

	async poll() {
		try {
			const res = await fetch(`/domotics/printers/${this.id}/status`);
			if (!res.ok) throw new Error(`status ${res.status}`);
			this.telemetry = TelemetrySchema.parse(await res.json());
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'poll failed';
		}
	}

	/** True when there is a print the user could stop. */
	get canStop(): boolean {
		const t = this.telemetry;
		return Boolean(t?.online) && isStoppableState(t?.state);
	}

	/**
	 * Cancels the running print. Irreversible — the firmware discards the job — so the caller is
	 * expected to have confirmed with the user first.
	 */
	async stopPrint(): Promise<void> {
		if (this.stopping) return;
		this.stopping = true;
		try {
			const res = await fetch(`/domotics/printers/${this.id}/job`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			addToast('Print stopped');
			// The state badge and progress come from the poll, so pull a fresh one immediately
			// rather than leaving PRINTING on screen for up to another interval.
			await this.poll();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not stop the print', 'error');
		} finally {
			this.stopping = false;
		}
	}

	start(intervalMs = 2000) {
		this.poll();
		this.timer = setInterval(() => this.poll(), intervalMs);
	}

	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
