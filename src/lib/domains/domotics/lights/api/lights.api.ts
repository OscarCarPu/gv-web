import { fetchAPI } from '$lib/shared/api/client';
import {
	LightListSchema,
	LightStateSchema,
	LightStatesSchema,
	type LightCommand,
	type LightInfo,
	type LightState,
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
};
