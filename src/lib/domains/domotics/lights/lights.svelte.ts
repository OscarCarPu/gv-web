import { addToast } from '$lib/shared/stores/toast.svelte';
import {
	LightStateSchema,
	LightStatesSchema,
	type LightCommand,
	type LightState,
} from './api/lights.schemas';

/**
 * Controller for the Lights tab.
 *
 * Two things shape it, both consequences of BLE being slow (a connect + write is
 * hundreds of ms, sometimes seconds):
 *
 * 1. Every command is applied optimistically and reconciled with whatever the server
 *    answers. Waiting for the round-trip would make a toggle feel broken.
 * 2. Sliders throttle to one write in flight per bulb with a trailing send, so dragging
 *    brightness produces a couple of writes instead of sixty. Without it the bulb's
 *    queue backs up and it stops answering entirely.
 *
 * Polling exists to catch changes made outside the app (a physical switch, another
 * client), but it must never undo a change the user just made — hence the grace window.
 */

const POLL_INTERVAL_MS = 5000;
/** How long a local change wins over polled state. Covers a slow BLE write. */
const POLL_GRACE_MS = 4000;
/** Minimum spacing between writes of the same continuous control. */
const THROTTLE_MS = 250;

type Pending = { timer: ReturnType<typeof setTimeout> | null; command: LightCommand | null };

export class LightsController {
	states = $state<LightState[]>([]);
	/** Bulbs with a write in flight — used to disable the switch, not to block input. */
	busy = $state<Record<string, boolean>>({});
	polling = $state(false);

	private timer: ReturnType<typeof setInterval> | null = null;
	/** id → epoch ms of the last local change, so polls do not walk it back. */
	private touchedAt = new Map<string, number>();
	/** id+type → trailing write waiting for the throttle window. */
	private queued = new Map<string, Pending>();
	private inFlight = new Set<string>();
	private stopped = false;

	constructor(initial: LightState[]) {
		this.states = initial;
	}

	get anyOn(): boolean {
		return this.states.some((s) => s.power && s.online);
	}

	get onCount(): number {
		return this.states.filter((s) => s.power && s.online).length;
	}

	get offlineCount(): number {
		return this.states.filter((s) => !s.online).length;
	}

	// ---- polling ----

	start() {
		this.stopped = false;
		this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
	}

	stop() {
		this.stopped = true;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		for (const pending of this.queued.values()) {
			if (pending.timer) clearTimeout(pending.timer);
		}
		this.queued.clear();
	}

	async poll() {
		if (this.polling) return;
		this.polling = true;
		try {
			const res = await fetch('/domotics/lights/state');
			if (!res.ok) throw new Error(`status ${res.status}`);
			const { states } = LightStatesSchema.parse(await res.json());
			if (this.stopped) return;
			this.merge(states);
		} catch {
			// A failed poll is not worth a toast — the next one is 5s away, and per-bulb
			// reachability already shows on the cards.
		} finally {
			this.polling = false;
		}
	}

	/** Take polled state except where the user just acted or a write is still open. */
	private merge(incoming: LightState[]) {
		const now = Date.now();
		this.states = this.states.map((current) => {
			const next = incoming.find((s) => s.id === current.id);
			if (!next) return current;

			const touched = this.touchedAt.get(current.id) ?? 0;
			if (this.busy[current.id] || now - touched < POLL_GRACE_MS) {
				// Reachability is server truth regardless — only the settings are held back.
				return { ...current, online: next.online, error: next.error };
			}
			return next;
		});
	}

	// ---- local state ----

	private patch(id: string, changes: Partial<LightState>) {
		this.touchedAt.set(id, Date.now());
		this.states = this.states.map((s) => (s.id === id ? { ...s, ...changes } : s));
	}

	private replace(state: LightState) {
		this.states = this.states.map((s) => (s.id === state.id ? state : s));
	}

	// ---- commands ----

	private async send(id: string, command: LightCommand): Promise<void> {
		this.busy = { ...this.busy, [id]: true };
		try {
			const res = await fetch(`/domotics/lights/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(command),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `status ${res.status}`);
			}
			const state = LightStateSchema.parse(await res.json());
			// The bulb is the authority on what it ended up doing.
			this.replace(state);
			this.touchedAt.set(id, Date.now());
			if (!state.online && state.error) {
				addToast(`${state.name}: ${state.error}`, 'error');
			}
		} catch (e) {
			const name = this.states.find((s) => s.id === id)?.name ?? id;
			addToast(`${name}: ${e instanceof Error ? e.message : 'command failed'}`, 'error');
			// Drop the optimistic value by taking the server's word on the next read.
			this.touchedAt.delete(id);
			this.refresh(id);
		} finally {
			this.busy = { ...this.busy, [id]: false };
		}
	}

	/**
	 * One write at a time per (bulb, control); the newest value while one is open is kept
	 * and sent when it closes. Intermediate slider positions are dropped on purpose —
	 * only where the finger ends up matters.
	 */
	private throttled(id: string, key: string, command: LightCommand) {
		const slot = `${id}:${key}`;

		if (this.inFlight.has(slot)) {
			const pending = this.queued.get(slot) ?? { timer: null, command: null };
			pending.command = command;
			this.queued.set(slot, pending);
			return;
		}

		this.inFlight.add(slot);
		this.send(id, command).finally(() => {
			const pending = this.queued.get(slot);
			this.queued.delete(slot);
			this.inFlight.delete(slot);

			if (pending?.command && !this.stopped) {
				const trailing = pending.command;
				const timer = setTimeout(() => this.throttled(id, key, trailing), THROTTLE_MS);
				this.queued.set(slot, { timer, command: null });
			}
		});
	}

	async refresh(id: string) {
		try {
			const res = await fetch(`/domotics/lights/${id}?force=1`);
			if (!res.ok) return;
			this.replace(LightStateSchema.parse(await res.json()));
		} catch {
			// Best-effort resync; the poll loop retries anyway.
		}
	}

	togglePower(id: string) {
		const state = this.states.find((s) => s.id === id);
		if (!state) return;
		const on = !state.power;
		this.patch(id, { power: on });
		this.send(id, { type: 'power', on });
	}

	setBrightness(id: string, value: number) {
		// Real bulbs come on when dimmed up from zero — reflect that immediately.
		const changes: Partial<LightState> = { brightness: value };
		if (value > 0) changes.power = true;
		this.patch(id, changes);
		this.throttled(id, 'brightness', { type: 'brightness', value });
	}

	setColor(id: string, color: { r: number; g: number; b: number }) {
		this.patch(id, { color, mode: 'color', power: true });
		this.throttled(id, 'color', { type: 'color', color });
	}

	setColorTemp(id: string, kelvin: number) {
		this.patch(id, { colorTemp: kelvin, mode: 'white', power: true });
		this.throttled(id, 'colorTemp', { type: 'colorTemp', kelvin });
	}

	/** Mode is not a command of its own — it is whichever colour command last landed. */
	setMode(id: string, mode: 'color' | 'white') {
		const state = this.states.find((s) => s.id === id);
		if (!state || state.mode === mode) return;
		if (mode === 'color') this.setColor(id, state.color);
		else this.setColorTemp(id, state.colorTemp);
	}

	/** Bulk switch. Fired in parallel — each bulb is an independent BLE connection. */
	setAll(on: boolean) {
		for (const state of this.states) {
			if (state.power === on) continue;
			this.patch(state.id, { power: on });
			this.send(state.id, { type: 'power', on });
		}
	}
}
