import * as z from 'zod';

export const RutasMarkSchema = z.object({
	id: z.number(),
	name: z.string(),
	visited_on: z.string(), // ISO date from Go: "2024-01-15T00:00:00Z"
	description: z.string(),
});

export const RutasMarksSchema = z
	.array(RutasMarkSchema)
	.nullable()
	.transform((v) => v ?? []);

export type RutasMark = z.infer<typeof RutasMarkSchema>;
