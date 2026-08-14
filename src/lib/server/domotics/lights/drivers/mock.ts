// In-memory driver. Keeps the Lights tab fully usable with no BLE hardware in reach —
// which is the normal case in dev, and on the lab server, which has no Bluetooth radio.
// State lives in the module, so it survives navigation but not a restart.

import {
	clamp,
	type LightCommand,
	type LightConfig,
	type LightDriver,
	type LightState,
} from '../types';

const states = new Map<string, LightState>();

function seed(light: LightConfig): LightState {
	return {
		id: light.id,
		name: light.name,
		model: light.model,
		online: true,
		power: false,
		brightness: 60,
		mode: light.supportsColor ? 'color' : 'white',
		color: { r: 255, g: 214, b: 170 },
		colorTemp: Math.round((light.minColorTemp + light.maxColorTemp) / 2),
		supportsColor: light.supportsColor,
		supportsColorTemp: light.supportsColorTemp,
		updatedAt: Date.now(),
	};
}

function current(light: LightConfig): LightState {
	let state = states.get(light.id);
	if (!state) {
		state = seed(light);
		states.set(light.id, state);
	}
	// Name/model/capabilities follow config, so an env edit shows up without a restart-and-clear.
	return {
		...state,
		name: light.name,
		model: light.model,
		supportsColor: light.supportsColor,
		supportsColorTemp: light.supportsColorTemp,
	};
}

/** Rough BLE round-trip, so the optimistic UI is exercised the way real hardware exercises it. */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockDriver: LightDriver = {
	kind: 'mock',

	async getState(light) {
		return current(light);
	},

	async apply(light, command: LightCommand) {
		await delay(120);
		const state = { ...current(light), updatedAt: Date.now() };

		switch (command.type) {
			case 'power':
				state.power = command.on;
				break;
			case 'brightness':
				state.brightness = clamp(Math.round(command.value), 0, 100);
				// Real bulbs light up when told to dim from off; match that.
				if (state.brightness > 0) state.power = true;
				break;
			case 'color':
				state.color = {
					r: clamp(Math.round(command.color.r), 0, 255),
					g: clamp(Math.round(command.color.g), 0, 255),
					b: clamp(Math.round(command.color.b), 0, 255),
				};
				state.mode = 'color';
				state.power = true;
				break;
			case 'colorTemp':
				state.colorTemp = clamp(Math.round(command.kelvin), light.minColorTemp, light.maxColorTemp);
				state.mode = 'white';
				state.power = true;
				break;
		}

		states.set(light.id, state);
		return state;
	},
};
