// Shared vocabulary between the routes, the drivers and the BLE bridge.
// Kept transport-agnostic on purpose: the bridge's JSON payloads are these exact shapes,
// so swapping the driver never changes what the browser sees.

export type RGB = { r: number; g: number; b: number };

/** How the bulb is currently rendering colour. Bulbs that only do one of the two
 *  report that one and ignore commands for the other. */
export type LightMode = 'color' | 'white';

export type LightState = {
	id: string;
	name: string;
	model: string;
	/** false when the last transaction with the bulb failed — the rest of the fields
	 *  are then the last known values, not live ones. */
	online: boolean;
	power: boolean;
	/** 0–100. Not the bulb's native scale — drivers convert. */
	brightness: number;
	mode: LightMode;
	color: RGB;
	/** Kelvin. Clamped to the bulb's own range by the driver. */
	colorTemp: number;
	/** Capabilities, so the UI hides controls a bulb does not have. */
	supportsColor: boolean;
	supportsColorTemp: boolean;
	/** Last error, surfaced per card instead of failing the whole page. */
	error?: string;
	/** Epoch ms of the last successful read/write, for the staleness hint. */
	updatedAt: number;
};

export type LightCommand =
	| { type: 'power'; on: boolean }
	| { type: 'brightness'; value: number }
	| { type: 'color'; color: RGB }
	| { type: 'colorTemp'; kelvin: number };

/** A bulb as configured server-side. `address` and anything under `options` are
 *  secrets-adjacent (they identify hardware) and never leave the server. */
export type LightConfig = {
	id: string;
	name: string;
	model: string;
	/** BLE MAC (or platform-specific address) the bridge connects to. */
	address: string;
	/** Protocol name the bridge dispatches on, e.g. 'mock' or a vendor id. */
	protocol: string;
	supportsColor: boolean;
	supportsColorTemp: boolean;
	/** Kelvin range the bulb accepts. */
	minColorTemp: number;
	maxColorTemp: number;
	/** Free-form per-protocol settings (service/characteristic UUIDs, keys…). */
	options?: Record<string, unknown>;
};

export interface LightDriver {
	readonly kind: string;
	/** Read current state. Must never throw — return the state with `online: false`
	 *  and an `error` instead, so one dead bulb cannot blank the page. */
	getState(light: LightConfig): Promise<LightState>;
	/** Apply a command and return the resulting state. Same no-throw contract. */
	apply(light: LightConfig, command: LightCommand): Promise<LightState>;
}

export const DEFAULT_MIN_KELVIN = 2200;
export const DEFAULT_MAX_KELVIN = 6500;

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Baseline used when a bulb has never answered yet. */
export function offlineState(light: LightConfig, error: string): LightState {
	return {
		id: light.id,
		name: light.name,
		model: light.model,
		online: false,
		power: false,
		brightness: 0,
		mode: light.supportsColor ? 'color' : 'white',
		color: { r: 255, g: 255, b: 255 },
		colorTemp: light.minColorTemp,
		supportsColor: light.supportsColor,
		supportsColorTemp: light.supportsColorTemp,
		error,
		updatedAt: Date.now(),
	};
}
