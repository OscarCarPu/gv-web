const STORAGE_KEY = 'device_id';

/**
 * Returns a stable per-browser UUID, generating and persisting one in
 * localStorage on first call. Returns undefined on the server (no localStorage).
 */
export function getDeviceId(): string | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	let id = localStorage.getItem(STORAGE_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, id);
	}
	return id;
}
