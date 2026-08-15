import * as z from 'zod';

/**
 * Mirrors `gv-api/internal/lights/dto.go`. Field names are camelCase rather than the
 * snake_case used by the rest of the API: this shape is passed through from the BLE bridge
 * daemon unchanged, and renaming it in the middle would only add a layer to get wrong.
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

export type RGB = z.infer<typeof RGBSchema>;
export type LightState = z.infer<typeof LightStateSchema>;
export type LightInfo = z.infer<typeof LightInfoSchema>;

export type LightCommand =
	| { type: 'power'; on: boolean }
	| { type: 'brightness'; value: number }
	| { type: 'color'; color: RGB }
	| { type: 'colorTemp'; kelvin: number };
