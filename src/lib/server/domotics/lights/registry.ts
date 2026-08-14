// Driver selection + the read cache the polling UI leans on.
//
// BLE is slow and serialises badly: a connect/read round-trip is hundreds of ms and two
// overlapping ones to the same bulb tend to fail outright. The page polls every few
// seconds, so reads are cached for LIGHTS_CACHE_MS and concurrent reads of the same bulb
// share one in-flight promise. Writes bypass the cache and replace it with their result.

import { allLights, getLight } from './config';
import { bridgeDriver } from './drivers/bridge';
import { mockDriver } from './drivers/mock';
import {
	offlineState,
	type LightCommand,
	type LightConfig,
	type LightDriver,
	type LightState,
} from './types';

const DRIVERS: Record<string, LightDriver> = {
	mock: mockDriver,
	bridge: bridgeDriver,
};

export function getDriver(): LightDriver {
	const kind = (process.env.LIGHTS_DRIVER ?? 'mock').trim();
	const driver = DRIVERS[kind];
	if (!driver) {
		console.warn(`LIGHTS_DRIVER="${kind}" is unknown — falling back to mock`);
		return mockDriver;
	}
	return driver;
}

function cacheMs(): number {
	const raw = Number(process.env.LIGHTS_CACHE_MS);
	return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
}

type Entry = { state: LightState; at: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<LightState>>();

function store(state: LightState): LightState {
	cache.set(state.id, { state, at: Date.now() });
	return state;
}

export async function readState(light: LightConfig, force = false): Promise<LightState> {
	if (!force) {
		const hit = cache.get(light.id);
		if (hit && Date.now() - hit.at < cacheMs()) return hit.state;
	}

	const pending = inFlight.get(light.id);
	if (pending) return pending;

	const promise = getDriver()
		.getState(light)
		.then(store)
		.finally(() => inFlight.delete(light.id));

	inFlight.set(light.id, promise);
	return promise;
}

export async function sendCommand(light: LightConfig, command: LightCommand): Promise<LightState> {
	const state = await getDriver().apply(light, command);
	return store(state);
}

/** Every bulb's state, read in parallel. Drivers never throw, so this never rejects. */
export function readAllStates(force = false): Promise<LightState[]> {
	return Promise.all(allLights().map((light) => readState(light, force)));
}

/** Last known state per bulb without touching the radio. */
export function knownStates(): LightState[] {
	return allLights().map((light) => cache.get(light.id)?.state ?? offlineState(light, ''));
}

/**
 * Read every bulb, but give up after `timeoutMs` and answer with whatever is already
 * known. SSR must never hang on a radio: a cold BLE connect can take ten seconds or more
 * when BlueZ has to rediscover an unbonded bulb, and the page would sit blank for all of
 * it. The read keeps running in the background and populates the cache, so the client's
 * first poll — two seconds later — gets the real thing.
 */
export async function readAllStatesOrKnown(timeoutMs = 1500): Promise<LightState[]> {
	let timer: ReturnType<typeof setTimeout>;
	const deadline = new Promise<LightState[]>((resolve) => {
		timer = setTimeout(() => resolve(knownStates()), timeoutMs);
	});

	try {
		return await Promise.race([readAllStates(), deadline]);
	} finally {
		clearTimeout(timer!);
	}
}

export { getLight, allLights };
