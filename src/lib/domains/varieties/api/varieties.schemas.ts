import * as z from 'zod';

export const VarietyResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	scent: z.number(),
	flavor: z.number(),
	power: z.number(),
	quality: z.number(),
	score: z.number(),
	price: z.number(),
	comments: z.string().nullable(),
});

export const VarietyResponseListSchema = z
	.array(VarietyResponseSchema)
	.nullable()
	.transform((v) => v ?? []);
