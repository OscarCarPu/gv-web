const STORAGE_KEY = 'device_id';

/**
 * `crypto.randomUUID` only exists in secure contexts, so it is missing whenever
 * the app is served over plain HTTP from anything other than localhost (a LAN
 * IP or hostname, say). Falling back keeps the header working there instead of
 * throwing inside every API call.
 */
function randomUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	const bytes = new Uint8Array(16);
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

	const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Returns a stable per-browser UUID, generating and persisting one in
 * localStorage on first call. Returns undefined on the server (no localStorage).
 * Never throws: the header is a nice-to-have, not a reason to fail a request.
 */
export function getDeviceId(): string | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	try {
		let id = localStorage.getItem(STORAGE_KEY);
		if (!id) {
			id = randomUUID();
			localStorage.setItem(STORAGE_KEY, id);
		}
		return id;
	} catch {
		return undefined;
	}
}
