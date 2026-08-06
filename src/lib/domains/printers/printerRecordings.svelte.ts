// Controller for the camera recordings panel. Same shape as PrinterFilesController.
//
// Recording lives entirely on the server, so this holds no recording state of its own — it polls
// what the backend reports. Closing the page, reloading or losing the network never stops a
// recording, and a page that comes back simply sees it still running.

import { addToast } from '$shared/stores/toast.svelte';
import { RecordingsSchema, type Recording } from './api/printers.schemas';

/** Idle polling is only for the odd recording started from another device; recording needs the
 *  size and elapsed time to actually move. */
const IDLE_POLL_MS = 15_000;
const RECORDING_POLL_MS = 3_000;

export class PrinterRecordingsController {
	readonly id: string;

	recordings = $state<Recording[]>([]);
	usedBytes = $state(0);
	maxBytes = $state(0);
	loading = $state(true);
	error = $state<string | null>(null);
	/** Set while start/stop is in flight, so the button cannot be double-fired. */
	busy = $state(false);
	/** Name of the recording a delete is running for. */
	deleting = $state<string | null>(null);

	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;

	constructor(id: string) {
		this.id = id;
	}

	private get base(): string {
		return `/printers/${this.id}/recordings`;
	}

	/** The recording being written right now, if any. */
	get active(): Recording | null {
		return this.recordings.find((r) => r.recording) ?? null;
	}

	get isRecording(): boolean {
		return this.active !== null;
	}

	async refresh(): Promise<void> {
		try {
			const res = await fetch(this.base, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = RecordingsSchema.parse(await res.json());
			this.recordings = data.recordings;
			this.usedBytes = data.usedBytes;
			this.maxBytes = data.maxBytes;
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Could not list recordings';
		} finally {
			this.loading = false;
		}
	}

	private async command(action: 'start' | 'stop'): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			const res = await fetch(`${this.base}?action=${action}`, {
				method: 'POST',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			addToast(action === 'start' ? 'Recording started' : 'Recording saved');
		} catch (e) {
			addToast(e instanceof Error ? e.message : `Could not ${action} recording`, 'error');
		} finally {
			this.busy = false;
			await this.refresh();
			this.reschedule();
		}
	}

	startRecording(): Promise<void> {
		return this.command('start');
	}

	stopRecording(): Promise<void> {
		return this.command('stop');
	}

	async remove(name: string): Promise<void> {
		this.deleting = name;
		try {
			const res = await fetch(`${this.base}?name=${encodeURIComponent(name)}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			addToast('Recording deleted');
			await this.refresh();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not delete the recording', 'error');
		} finally {
			this.deleting = null;
		}
	}

	/** setTimeout rather than setInterval: the cadence changes with whether we are recording. */
	private reschedule(): void {
		if (this.timer) clearTimeout(this.timer);
		if (!this.running) return;
		this.timer = setTimeout(
			async () => {
				await this.refresh();
				this.reschedule();
			},
			this.isRecording ? RECORDING_POLL_MS : IDLE_POLL_MS
		);
	}

	start(): void {
		this.running = true;
		void this.refresh().then(() => this.reschedule());
	}

	/** Stops polling only. The recording itself is the server's, and keeps going. */
	stop(): void {
		this.running = false;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}
}
