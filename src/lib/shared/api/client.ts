import * as z from 'zod';
import { browser } from '$app/environment';
import { env } from '$lib/config/env';
import { getDeviceId } from '$lib/shared/utils/deviceId';

/** A failed API call. `code` is the API's machine-readable reason, when it sends one. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/** The backend is running on the backup server and this feature needs the home LAN. */
export function isUnavailableOnFailover(e: unknown): boolean {
	return e instanceof ApiError && e.code === 'unavailable_on_failover';
}

let clientToken: string | undefined;

export function setClientToken(token: string | undefined) {
	clientToken = token;
}

export function apiUrl(path: string): string {
	return `${browser ? env.API_URL : env.SERVER_API_URL}${path}`;
}

export function authHeaders(): Record<string, string> {
	return clientToken ? { Authorization: `Bearer ${clientToken}` } : {};
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	return fetch(apiUrl(path), {
		...init,
		headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
	});
}

export async function fetchAPI<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	options?: RequestInit & { token?: string }
): Promise<T> {
	const baseUrl = browser ? env.API_URL : env.SERVER_API_URL;
	const token = options?.token || (browser ? clientToken : undefined);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options?.headers as Record<string, string>),
	};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	if (browser) {
		const deviceId = getDeviceId();
		if (deviceId) headers['X-Device-ID'] = deviceId;
	}

	const response = await fetch(`${baseUrl}${endpoint}`, {
		...options,
		headers,
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		const message = errorData.error || `API Error: ${response.status} ${response.statusText}`;
		throw new ApiError(message, response.status, errorData.code);
	}

	if (response.status === 204 || schema instanceof z.ZodVoid) {
		return undefined as T;
	}

	const data = await response.json();
	return schema.parse(data);
}
