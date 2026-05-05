import * as z from 'zod';

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

export const AccountSchema = z.object({
	id: z.number(),
	name: z.string(),
	total: z.string(),
	created_at: z.string(),
});

export const AccountListSchema = z
	.array(AccountSchema)
	.nullable()
	.transform((v) => v ?? []);

export const CategorySchema = z.object({
	id: z.number(),
	name: z.string(),
	parent_id: z.number().nullable(),
	type: TransactionTypeSchema,
	created_at: z.string(),
});

export const CategoryListSchema = z
	.array(CategorySchema)
	.nullable()
	.transform((v) => v ?? []);

export const TransactionSchema = z.object({
	id: z.number(),
	type: TransactionTypeSchema,
	amount: z.string(),
	account_id: z.number(),
	to_account_id: z.number().nullable(),
	category_id: z.number().nullable(),
	description: z.string().nullable(),
	occurred_at: z.string(),
	created_at: z.string(),
});

export const TransactionListSchema = z
	.array(TransactionSchema)
	.nullable()
	.transform((v) => v ?? []);

export const OverviewTransactionSchema = z.object({
	id: z.number(),
	type: TransactionTypeSchema,
	amount: z.string(),
	account_name: z.string(),
	to_account_name: z.string().nullable(),
	category_name: z.string().nullable(),
	description: z.string().nullable(),
	occurred_at: z.string(),
});

export const OverviewSchema = z.object({
	accounts_total: z.string(),
	month: z.object({
		income: z.string(),
		expense: z.string(),
		balance: z.string(),
	}),
	recent_transactions: z
		.array(OverviewTransactionSchema)
		.nullable()
		.transform((v) => v ?? []),
});
