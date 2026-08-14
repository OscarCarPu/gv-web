import { TelemetrySchema, type Telemetry } from './api/printers.schemas';

// Controller for a single printer view: polls telemetry on an interval and
// exposes reactive state. The camera feed is driven separately by the component
// (a plain <img> refresh loop) to keep the image path off the JSON poll.

export class PrinterController {
	readonly id: string;
	telemetry = $state<Telemetry | null>(null);
	error = $state<string | null>(null);
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

	start(intervalMs = 2000) {
		this.poll();
		this.timer = setInterval(() => this.poll(), intervalMs);
	}

	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
