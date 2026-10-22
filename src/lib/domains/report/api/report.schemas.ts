import * as z from 'zod';

const RowSchema = z
	.record(z.string(), z.unknown())
	.nullish()
	.transform((v) => v ?? null);

export const ReportItemSchema = z.object({
	table: z.string(),
	key: z.string(),
	op: z.enum(['insert', 'update', 'delete']),
	base: RowSchema,
	home: RowSchema,
	ec2: RowSchema,
	related: z
		.record(z.string(), z.object({ table: z.string(), row: z.record(z.string(), z.unknown()) }))
		.nullish()
		.transform((v) => v ?? {}),
});

export const ReportSchema = z.object({
	items: z
		.array(ReportItemSchema)
		.nullish()
		.transform((v) => v ?? []),
	skipped: z
		.array(z.string())
		.nullish()
		.transform((v) => v ?? []),
	error: z.string().optional(),
});

export const ReportStatusSchema = z.object({
	mode: z.enum(['normal', 'hold', 'merge']),
	merge: z.enum(['', 'running', 'done', 'failed']),
	error: z.string().optional(),
	report: ReportSchema.nullish().transform((v) => v ?? null),
});

export type ReportItem = z.infer<typeof ReportItemSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
