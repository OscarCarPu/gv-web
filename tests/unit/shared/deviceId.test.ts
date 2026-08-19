import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getDeviceId } from '$lib/shared/utils/deviceId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fakeStorage(): Storage {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear(),
		key: () => null,
		get length() {
			return map.size;
		},
	} as Storage;
}

beforeEach(() => {
	vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('getDeviceId', () => {
	it('returns a stable id across calls', () => {
		const first = getDeviceId();
		expect(first).toMatch(UUID_V4);
		expect(getDeviceId()).toBe(first);
	});

	// `crypto.randomUUID` is secure-context only, so it is missing whenever the
	// app is served over plain HTTP from a LAN IP or hostname. It used to throw
	// there, which took down every client-side API call with it.
	it('falls back when crypto.randomUUID is unavailable', () => {
		vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(crypto) });

		const id = getDeviceId();
		expect(id).toMatch(UUID_V4);
	});

	it('falls back when crypto is missing entirely', () => {
		vi.stubGlobal('crypto', undefined);

		expect(getDeviceId()).toMatch(UUID_V4);
	});

	it('returns undefined instead of throwing when localStorage is unusable', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {},
		} as unknown as Storage);

		expect(getDeviceId()).toBeUndefined();
	});
});
