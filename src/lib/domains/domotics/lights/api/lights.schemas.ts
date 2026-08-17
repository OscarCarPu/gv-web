import * as z from 'zod';

/**
 * Mirrors `gv-api/internal/lights/dto.go`. Field names are camelCase rather than the
 * snake_case used by the rest of the API — the shape three clients already model, and
 * renaming it now would only add a translation layer to get wrong.
 */

export const RGBSchema = z.object({
	r: z.number(),
	g: z.number(),
	b: z.number(),
});

export const LightStateSchema = z.object({
	id: z.string(),
	name: z.string(),
	model: z.string(),
	online: z.boolean(),
	power: z.boolean(),
	brightness: z.number(),
	mode: z.enum(['color', 'white']),
	color: RGBSchema,
	colorTemp: z.number(),
	supportsColor: z.boolean(),
	supportsColorTemp: z.boolean(),
	minColorTemp: z.number(),
	maxColorTemp: z.number(),
	error: z.string().optional(),
	updatedAt: z.number(),
});

export const LightStatesSchema = z.object({
	states: z
		.array(LightStateSchema)
		.nullable()
		.transform((v) => v ?? []),
});

/** A configured bulb without live state — capabilities only, and never its BLE address. */
export const LightInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	model: z.string(),
	supportsColor: z.boolean(),
	supportsColorTemp: z.boolean(),
	minColorTemp: z.number(),
	maxColorTemp: z.number(),
});

export const LightListSchema = z
	.array(LightInfoSchema)
	.nullable()
	.transform((v) => v ?? []);

/**
 * A bulb the adapter can hear right now. `address` is the only handle a person has for
 * telling two nameless lamps apart, which is why it is public here and nowhere else.
 */
export const DiscoveredSchema = z.object({
	address: z.string(),
	name: z.string(),
	rssi: z.number(),
	known: z.boolean(),
});

export const DiscoveredListSchema = z.object({
	devices: z
		.array(DiscoveredSchema)
		.nullable()
		.transform((v) => v ?? []),
});

/** One supported bulb family, used to fill in what a model can do so nobody has to know. */
export const ProtocolInfoSchema = z.object({
	name: z.string(),
	label: z.string(),
	supportsColor: z.boolean(),
	supportsColorTemp: z.boolean(),
	minColorTemp: z.number(),
	maxColorTemp: z.number(),
});

export const ProtocolListSchema = z
	.array(ProtocolInfoSchema)
	.nullable()
	.transform((v) => v ?? []);

export type RGB = z.infer<typeof RGBSchema>;
export type LightState = z.infer<typeof LightStateSchema>;
export type LightInfo = z.infer<typeof LightInfoSchema>;
export type Discovered = z.infer<typeof DiscoveredSchema>;
export type ProtocolInfo = z.infer<typeof ProtocolInfoSchema>;

export type CreateLightRequest = {
	name: string;
	address: string;
	protocol: string;
	model?: string;
};

export type UpdateLightRequest = {
	name?: string;
	model?: string;
};

export type LightCommand =
	| { type: 'power'; on: boolean }
	| { type: 'brightness'; value: number }
	| { type: 'color'; color: RGB }
	| { type: 'colorTemp'; kelvin: number };
