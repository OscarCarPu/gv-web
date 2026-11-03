// Controller for the camera recordings panel. Same shape as PrinterFilesController.
//
// Recording lives entirely on the server, so this holds no recording state of its own — it polls
// what the backend reports. Closing the page, reloading or losing the network never stops a
// recording, and a page that comes back simply sees it still running.

import { SvelteSet } from 'svelte/reactivity';
import { addToast } from '$shared/stores/toast.svelte';
import { apiFetch } from '$shared/api/client';
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
	/** Recordings marked for a bulk delete, by name. */
	selected = new SvelteSet<string>();
	/** True while a bulk delete is running. */
	deletingSelected = $state(false);

	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;

	constructor(id: string) {
		this.id = id;
	}

	private get base(): string {
		return `/domotics/printers/${this.id}/recordings`;
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
			const res = await apiFetch(this.base, { headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = RecordingsSchema.parse(await res.json());
			this.recordings = data.recordings;
			for (const name of this.selected) {
				if (!data.recordings.some((r) => r.name === name && !r.recording))
					this.selected.delete(name);
			}
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
			const res = await apiFetch(`${this.base}?action=${action}`, {
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
			const res = await apiFetch(`${this.base}?name=${encodeURIComponent(name)}`, {
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

	/** Saved recordings, the only ones that can be selected (the live one cannot be deleted). */
	get saved(): Recording[] {
		return this.recordings.filter((r) => !r.recording);
	}

	get allSelected(): boolean {
		const saved = this.saved;
		return saved.length > 0 && saved.every((r) => this.selected.has(r.name));
	}

	toggle(name: string): void {
		if (this.selected.has(name)) this.selected.delete(name);
		else this.selected.add(name);
	}

	toggleAll(): void {
		if (this.allSelected) {
			this.selected.clear();
			return;
		}
		for (const r of this.saved) this.selected.add(r.name);
	}

	/** Deletes every marked recording in one request; the server reports which ones failed. */
	async removeSelected(): Promise<void> {
		const names = [...this.selected];
		if (names.length === 0 || this.deletingSelected) return;
		this.deletingSelected = true;
		try {
			const q = names.map((n) => `name=${encodeURIComponent(n)}`).join('&');
			const res = await apiFetch(`${this.base}?${q}`, {
				method: 'DELETE',
				headers: { Accept: 'application/json' },
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.error ?? `status ${res.status}`);
			const deleted: string[] = body?.deleted ?? [];
			const failed: Record<string, string> = body?.failed ?? {};
			for (const n of deleted) this.selected.delete(n);
			if (deleted.length > 0) {
				addToast(`${deleted.length} recording${deleted.length === 1 ? '' : 's'} deleted`);
			}
			const errors = Object.values(failed);
			if (errors.length > 0) {
				addToast(`${errors.length} could not be deleted. ${errors[0]}`, 'error');
			}
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not delete the recordings', 'error');
		} finally {
			this.deletingSelected = false;
			await this.refresh();
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
