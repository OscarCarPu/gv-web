import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

/**
 * Owns the Web-Audio "block started" alarm for Today's Plan. The component drives
 * it from a single `$effect` watching the current block index:
 *   - `watch(currentIndex, block)` — fire on the same index-change transition as before
 *     (notifications enabled, a block is current, and the index just changed): open the
 *     modal and start the chirp.
 *   - `dismiss()` — stop the sound and close the modal.
 * The browser-only Web Audio (`AudioContext`, oscillator chirp) is guarded with
 * `typeof window !== 'undefined'`, mirroring the original component. Mirrors `TaskTimer`:
 * `$state` for template-read state, a private `#clearTimers()` teardown the component
 * calls on unmount.
 */
export class PlanAlarm {
	// Public reactive state, read directly by the template. Notifications default ON.
	#enabled = $state(true);
	#alarmOpen = $state(false);
	#alarmBlock = $state<PlanBlockResponse | null>(null);

	// Private, non-template state.
	#prevCurrentIndex = -1;
	// Skip the very first watch() (initial mount) so we only fire on a real block
	// transition while the page is open — not on every load of an already-active block.
	#primed = false;
	#audioCtx: AudioContext | null = null;
	#alarmInterval: ReturnType<typeof setInterval> | null = null;

	get enabled(): boolean {
		return this.#enabled;
	}

	set enabled(value: boolean) {
		this.#enabled = value;
	}

	get alarmOpen(): boolean {
		return this.#alarmOpen;
	}

	get alarmBlock(): PlanBlockResponse | null {
		return this.#alarmBlock;
	}

	// ── sound engine ────────────────────────────────────────────────────

	#startAlarmSound(): void {
		if (typeof window === 'undefined') return;
		if (!this.#audioCtx) this.#audioCtx = new AudioContext();
		let high = true;

		const chirp = () => {
			const ctx = this.#audioCtx;
			if (!ctx) return;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'square';
			osc.frequency.value = high ? 960 : 800;
			high = !high;
			osc.connect(gain);
			gain.connect(ctx.destination);
			const t = ctx.currentTime;
			gain.gain.setValueAtTime(0.55, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
			osc.start(t);
			osc.stop(t + 0.17);
		};

		chirp();
		this.#alarmInterval = setInterval(chirp, 200);
	}

	#stopAlarmSound(): void {
		if (this.#alarmInterval) {
			clearInterval(this.#alarmInterval);
			this.#alarmInterval = null;
		}
	}

	#clearTimers(): void {
		this.#stopAlarmSound();
	}

	// ── public API ──────────────────────────────────────────────────────

	/**
	 * Called from the component's `$effect`. Reproduces the original firing condition
	 * exactly: fire only when notifications are enabled, a block is current, and the
	 * index just changed. Tracks the previous index on every call.
	 */
	watch(currentIndex: number, block: PlanBlockResponse | null): void {
		// Prime on the first call (initial mount) without firing.
		if (!this.#primed) {
			this.#primed = true;
			this.#prevCurrentIndex = currentIndex;
			return;
		}
		if (this.#enabled && currentIndex !== -1 && currentIndex !== this.#prevCurrentIndex) {
			this.#alarmBlock = block;
			this.#alarmOpen = true;
			this.#startAlarmSound();
		}
		this.#prevCurrentIndex = currentIndex;
	}

	/** Stop the sound and close the modal. */
	dismiss(): void {
		this.#alarmOpen = false;
		this.#stopAlarmSound();
	}

	/** Teardown for the component's unmount cleanup (mirrors `TaskTimer.#clearTimers`). */
	destroy(): void {
		this.#clearTimers();
	}
}
