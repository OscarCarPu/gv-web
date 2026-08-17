import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	DiscoveredListSchema,
	LightInfoSchema,
	LightListSchema,
	LightStateSchema,
	LightStatesSchema,
	ProtocolListSchema,
	type CreateLightRequest,
	type Discovered,
	type LightCommand,
	type LightInfo,
	type LightState,
	type ProtocolInfo,
	type UpdateLightRequest,
} from './lights.schemas';

/**
 * Lights live in gv-api like every other domain — this app is only an interface over them.
 *
 * There is no gv-web server route in front of these: the browser calls gv-api directly with
 * the session token, exactly as tasks and money do.
 */
export const lightsApi = {
	/** Configured bulbs and their capabilities, without live state. */
	async list(token?: string): Promise<LightInfo[]> {
		return fetchAPI('/domotics/lights', LightListSchema, { token });
	},

	/** Every bulb's current state. `force` skips gv-api's short read cache. */
	async states(token?: string, force = false): Promise<LightState[]> {
		const query = force ? '?force=1' : '';
		const { states } = await fetchAPI(`/domotics/lights/state${query}`, LightStatesSchema, {
			token,
		});
		return states;
	},

	async state(id: string, token?: string, force = false): Promise<LightState> {
		const query = force ? '?force=1' : '';
		return fetchAPI(`/domotics/lights/${id}${query}`, LightStateSchema, { token });
	},

	/** Apply one command; the response is the bulb's resulting state. */
	async send(id: string, command: LightCommand, token?: string): Promise<LightState> {
		return fetchAPI(`/domotics/lights/${id}`, LightStateSchema, {
			token,
			method: 'POST',
			body: JSON.stringify(command),
		});
	},

	/**
	 * Scan for bulbs in range. Slow by nature — the answer does not exist until the radio has
	 * been listening for `seconds` — so callers must show it as work in progress.
	 */
	async discover(seconds = 8, token?: string): Promise<Discovered[]> {
		const { devices } = await fetchAPI(
			`/domotics/lights/discover?seconds=${seconds}`,
			DiscoveredListSchema,
			{ token }
		);
		return devices;
	},

	/** The bulb families the API can drive, with what each model can do. */
	async protocols(token?: string): Promise<ProtocolInfo[]> {
		return fetchAPI('/domotics/lights/protocols', ProtocolListSchema, { token });
	},

	async create(req: CreateLightRequest, token?: string): Promise<LightInfo> {
		return fetchAPI('/domotics/lights', LightInfoSchema, {
			token,
			method: 'POST',
			body: JSON.stringify(req),
		});
	},

	async update(id: string, req: UpdateLightRequest, token?: string): Promise<LightInfo> {
		return fetchAPI(`/domotics/lights/${id}`, LightInfoSchema, {
			token,
			method: 'PATCH',
			body: JSON.stringify(req),
		});
	},

	async remove(id: string, token?: string): Promise<void> {
		// The API answers 204, which fetchAPI short-circuits before it looks at the schema.
		await fetchAPI(`/domotics/lights/${id}`, z.void(), { token, method: 'DELETE' });
	},
};
