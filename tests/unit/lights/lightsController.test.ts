import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/domains/domotics/lights/api/lights.api', () => ({
	lightsApi: { states: vi.fn(), list: vi.fn() },
}));
vi.mock('$lib/shared/stores/toast', () => ({ addToast: vi.fn() }));

import { lightsApi } from '$lib/domains/domotics/lights/api/lights.api';
import { LightsController } from '$lib/domains/domotics/lights/lights.svelte';
import type { LightState } from '$lib/domains/domotics/lights/api/lights.schemas';

const states = vi.mocked(lightsApi.states);

function bulb(overrides: Partial<LightState> = {}): LightState {
	return {
		id: 'bedroom',
		name: 'Bedroom',
		model: 'LEXMAN',
		online: true,
		power: true,
		brightness: 50,
		mode: 'white',
		color: { r: 255, g: 255, b: 255 },
		colorTemp: 3000,
		supportsColor: false,
		supportsColorTemp: true,
		minColorTemp: 2700,
		maxColorTemp: 6500,
		updatedAt: 0,
		crazy: false,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('LightsController.start', () => {
	it('reads the cache first, then asks the bulbs for the real state', async () => {
		states.mockResolvedValueOnce([bulb({ brightness: 50 })]); // cached
		states.mockResolvedValueOnce([bulb({ brightness: 80 })]); // live
		const controller = new LightsController([], []);

		controller.start();
		await vi.advanceTimersByTimeAsync(0);

		expect(states).toHaveBeenNthCalledWith(1);
		expect(states).toHaveBeenNthCalledWith(2, undefined, true);
		expect(controller.states[0].brightness).toBe(80);
		controller.stop();
	});

	it('keeps the cached state when the live read fails', async () => {
		states.mockResolvedValueOnce([bulb({ brightness: 50 })]);
		states.mockRejectedValueOnce(new Error('timeout'));
		const controller = new LightsController([], []);

		controller.start();
		await vi.advanceTimersByTimeAsync(0);

		expect(controller.states[0].brightness).toBe(50);
		controller.stop();
	});

	it('goes live only once: the interval poll stays on the cache', async () => {
		states.mockResolvedValue([bulb()]);
		const controller = new LightsController([], []);

		controller.start();
		await vi.advanceTimersByTimeAsync(0);
		states.mockClear();

		await vi.advanceTimersByTimeAsync(5000);

		expect(states).toHaveBeenCalledTimes(1);
		expect(states).toHaveBeenCalledWith();
		controller.stop();
	});
});
