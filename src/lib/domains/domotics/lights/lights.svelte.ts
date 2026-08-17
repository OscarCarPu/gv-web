import { addToast } from '$lib/shared/stores/toast.svelte';
import { lightsApi } from './api/lights.api';
import type {
	CreateLightRequest,
	Discovered,
	LightCommand,
	LightInfo,
	LightState,
	ProtocolInfo,
	UpdateLightRequest,
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
 *
 * It also owns which bulbs exist, because that is now editable from this screen: a scan
 * finds what is in range, and naming one adds it.
 */

const POLL_INTERVAL_MS = 5000;
/** How long a local change wins over polled state. Covers a slow BLE write. */
const POLL_GRACE_MS = 4000;
/** Minimum spacing between writes of the same continuous control. */
const THROTTLE_MS = 250;
/** How long a scan listens. Long enough to cross a flat, short enough to feel answered. */
const SCAN_SECONDS = 8;

type Pending = { timer: ReturnType<typeof setTimeout> | null; command: LightCommand | null };

export class LightsController {
	lights = $state<LightInfo[]>([]);
	states = $state<LightState[]>([]);
	/** Bulbs with a write in flight — used to disable the switch, not to block input. */
	busy = $state<Record<string, boolean>>({});
	polling = $state(false);

	/** Adding a bulb: what the last scan heard, and the models we know how to drive. */
	devices = $state<Discovered[]>([]);
	protocols = $state<ProtocolInfo[]>([]);
	scanning = $state(false);
	saving = $state(false);

	private timer: ReturnType<typeof setInterval> | null = null;
	/** id → epoch ms of the last local change, so polls do not walk it back. */
	private touchedAt = new Map<string, number>();
	/** id+type → trailing write waiting for the throttle window. */
	private queued = new Map<string, Pending>();
	private inFlight = new Set<string>();
	private stopped = false;

	constructor(lights: LightInfo[], states: LightState[]) {
		this.lights = lights;
		this.states = states;
	}

	infoFor(id: string): LightInfo | undefined {
		return this.lights.find((l) => l.id === id);
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
		// A scan owns the radio for its whole window; polling through one just queues reads
		// that will time out and slows the scan down.
		if (this.polling || this.scanning) return;
		this.polling = true;
		try {
			const states = await lightsApi.states();
			if (this.stopped) return;
			this.merge(states);
		} catch {
			// A failed poll is not worth a toast — the next one is 5s away, and per-bulb
			// reachability already shows on the cards.
		} finally {
			this.polling = false;
		}
	}

	/**
	 * Take polled state except where the user just acted or a write is still open.
	 *
	 * Built from the incoming list rather than the local one, so the set of bulbs is the
	 * server's: one added elsewhere appears, one deleted elsewhere goes. Doing it the other
	 * way round left the page permanently empty whenever the SSR read timed out, since
	 * nothing could ever be added to an empty list.
	 */
	private merge(incoming: LightState[]) {
		const now = Date.now();
		const local = new Map(this.states.map((s) => [s.id, s]));

		this.states = incoming.map((next) => {
			const current = local.get(next.id);
			if (!current) return next;

			const touched = this.touchedAt.get(next.id) ?? 0;
			if (this.busy[next.id] || now - touched < POLL_GRACE_MS) {
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
			const state = await lightsApi.send(id, command);
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

		// Cancel a trailing send still waiting out its throttle window. This value is newer,
		// and letting the old timer fire behind it would land the bulb on the value the
		// finger passed through rather than the one it stopped on.
		const waiting = this.queued.get(slot);
		if (waiting?.timer) {
			clearTimeout(waiting.timer);
			this.queued.delete(slot);
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
			this.replace(await lightsApi.state(id, undefined, true));
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
		// Deliberately does not assume this turns the bulb on. Brightness and power are separate
		// frames on these bulbs, so dimming one that is off only changes how it will look when
		// switched on. Assuming otherwise made the card read "on" over a dark room, and made
		// "All on" a no-op because every bulb already looked on.
		this.patch(id, { brightness: value });
		this.throttled(id, 'brightness', { type: 'brightness', value });
	}

	setColor(id: string, color: { r: number; g: number; b: number }) {
		this.patch(id, { color, mode: 'color' });
		this.throttled(id, 'color', { type: 'color', color });
	}

	setColorTemp(id: string, kelvin: number) {
		this.patch(id, { colorTemp: kelvin, mode: 'white' });
		this.throttled(id, 'colorTemp', { type: 'colorTemp', kelvin });
	}

	/** Mode is not a command of its own — it is whichever colour command last landed. */
	setMode(id: string, mode: 'color' | 'white') {
		const state = this.states.find((s) => s.id === id);
		if (!state || state.mode === mode) return;
		if (mode === 'color') this.setColor(id, state.color);
		else this.setColorTemp(id, state.colorTemp);
	}

	/**
	 * Bulk switch. Fired in parallel — each bulb is an independent BLE connection.
	 *
	 * Sends to every bulb, including ones already believed to be in the target state. Skipping
	 * those saves a write but makes the button do nothing precisely when the believed state is
	 * wrong, which is when someone reaches for "All off".
	 */
	setAll(on: boolean) {
		for (const state of this.states) {
			this.patch(state.id, { power: on });
			this.send(state.id, { type: 'power', on });
		}
	}

	// ---- which bulbs exist ----

	/**
	 * Listen for bulbs in range.
	 *
	 * Takes as long as the scan does — there is no partial answer to show, because the radio
	 * has to spend the whole window listening before it knows what is out there.
	 */
	async scan() {
		if (this.scanning) return;
		this.scanning = true;
		try {
			// An empty result is not an error and gets no toast — the sheet says so in place,
			// where the person is already looking.
			this.devices = await lightsApi.discover(SCAN_SECONDS);
		} catch (e) {
			this.devices = [];
			addToast(e instanceof Error ? e.message : 'Scan failed', 'error');
		} finally {
			this.scanning = false;
		}
	}

	/** The models the API knows how to drive; loaded once, when the add sheet first opens. */
	async loadProtocols() {
		if (this.protocols.length > 0) return;
		try {
			this.protocols = await lightsApi.protocols();
		} catch {
			// The add form falls back to whatever the scan offered; no toast for a list that
			// only exists to prefill a select.
		}
	}

	async add(req: CreateLightRequest): Promise<boolean> {
		this.saving = true;
		try {
			await lightsApi.create(req);
			// Mark it added in the scan list, so the sheet can stay open to add its neighbour.
			this.devices = this.devices.map((d) =>
				d.address.toUpperCase() === req.address.toUpperCase() ? { ...d, known: true } : d
			);
			await this.reload();
			addToast(`${req.name} added`, 'success');
			return true;
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not add the bulb', 'error');
			return false;
		} finally {
			this.saving = false;
		}
	}

	async edit(id: string, req: UpdateLightRequest): Promise<boolean> {
		this.saving = true;
		try {
			await lightsApi.update(id, req);
			await this.reload();
			return true;
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not save the bulb', 'error');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/** Removes a bulb. Immediate, like every other destructive action in this app. */
	async remove(id: string): Promise<boolean> {
		const name = this.infoFor(id)?.name ?? id;
		this.saving = true;
		try {
			await lightsApi.remove(id);
			this.lights = this.lights.filter((l) => l.id !== id);
			this.states = this.states.filter((s) => s.id !== id);
			addToast(`${name} removed`, 'success');
			return true;
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Could not remove the bulb', 'error');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Re-read the registry and the bulbs after it changes.
	 *
	 * The state read is forced past the API's cache: a bulb added a second ago has no cached
	 * state, and a renamed one still has its old name in there.
	 */
	private async reload() {
		const [lights, states] = await Promise.all([
			lightsApi.list(),
			lightsApi.states(undefined, true),
		]);
		if (this.stopped) return;
		this.lights = lights;
		this.merge(states);
	}
}
