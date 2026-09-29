import * as z from 'zod';

const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

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

const OverviewMonthSchema = z.object({
	income: z.string(),
	expense: z.string(),
	balance: z.string(),
});

export const OverviewSchema = z.object({
	accounts_total: z.string(),
	month: OverviewMonthSchema,
	previous_month: OverviewMonthSchema,
	recent_transactions: z
		.array(OverviewTransactionSchema)
		.nullable()
		.transform((v) => v ?? []),
});

const NetWorthPointSchema = z.object({
	date: z.string(),
	total: z.string(),
});

export const NetWorthSeriesSchema = z
	.array(NetWorthPointSchema)
	.nullable()
	.transform((v) => v ?? []);

const CategoryStatSchema = z.object({
	category_id: z.number().nullable(),
	name: z.string(),
	amount: z.string(),
	share: z.number(),
	tx_count: z.number(),
});

export const CategoryStatsSchema = z
	.array(CategoryStatSchema)
	.nullable()
	.transform((v) => v ?? []);

const MonthlyStatSchema = z.object({
	month: z.string(),
	income: z.string(),
	expense: z.string(),
	balance: z.string(),
});

export const MonthlyStatsSchema = z
	.array(MonthlyStatSchema)
	.nullable()
	.transform((v) => v ?? []);

const EstimationPointSchema = z.object({
	date: z.string(),
	total: z.string(),
	estimated: z.boolean(),
});

export const EstimationResultSchema = z.object({
	points: z
		.array(EstimationPointSchema)
		.nullable()
		.transform((v) => v ?? []),
	rate: z.string(),
	saving: z.string(),
});

const BudgetTotalsSchema = z.object({
	budgeted: z.string(),
	actual: z.string(),
	unbudgeted: z.string(),
	overspent: z.string(),
});

const BudgetItemSchema = z.object({
	category_id: z.number(),
	period: z.enum(['monthly', 'yearly']),
	name: z.string(),
	parent_id: z.number().nullable(),
	type: z.enum(['income', 'expense']),
	depth: z.number(),
	budget: z.string(),
	actual: z.string(),
	remaining: z.string(),
	progress: z.number(),
	status: z.enum(['ok', 'warning', 'over', 'pending', 'met']),
	since: z.string(),
});

const BudgetAmountSchema = z.object({
	category_id: z.number(),
	amount: z.string(),
});

const BudgetItemListSchema = z
	.array(BudgetItemSchema)
	.nullable()
	.transform((v) => v ?? []);

const BudgetAmountListSchema = z
	.array(BudgetAmountSchema)
	.nullable()
	.transform((v) => v ?? []);

export const BudgetMonthSchema = z.object({
	month: z.string(),
	month_progress: z.number(),
	expense: BudgetTotalsSchema,
	income: BudgetTotalsSchema,
	items: BudgetItemListSchema,
	planned_balance: z.string(),
	yearly: z.object({
		year: z.string(),
		year_progress: z.number(),
		expense: BudgetTotalsSchema,
		income: BudgetTotalsSchema,
		items: BudgetItemListSchema,
	}),
	averages: BudgetAmountListSchema,
	previous_year: BudgetAmountListSchema,
});

export const OverviewTransactionListSchema = z
	.array(OverviewTransactionSchema)
	.nullable()
	.transform((v) => v ?? []);
