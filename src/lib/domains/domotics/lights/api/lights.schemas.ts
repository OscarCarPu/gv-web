import * as z from 'zod';

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
	error: z.string().optional(),
	updatedAt: z.number(),
});

export const LightStatesSchema = z.object({
	states: z.array(LightStateSchema),
});

export type RGB = z.infer<typeof RGBSchema>;
export type LightState = z.infer<typeof LightStateSchema>;

/** Public per-bulb config sent by the page loader — no BLE address. */
export type LightInfo = {
	id: string;
	name: string;
	model: string;
	supportsColor: boolean;
	supportsColorTemp: boolean;
	minColorTemp: number;
	maxColorTemp: number;
};

export type LightCommand =
	| { type: 'power'; on: boolean }
	| { type: 'brightness'; value: number }
	| { type: 'color'; color: RGB }
	| { type: 'colorTemp'; kelvin: number };
