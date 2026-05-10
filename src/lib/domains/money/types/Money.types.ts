export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Account {
	id: number;
	name: string;
	total: string;
	created_at: string;
}

export interface Category {
	id: number;
	name: string;
	parent_id: number | null;
	type: TransactionType;
	created_at: string;
}

export interface CategoryTree extends Category {
	children: CategoryTree[];
}

export interface Transaction {
	id: number;
	type: TransactionType;
	amount: string;
	account_id: number;
	to_account_id: number | null;
	category_id: number | null;
	description: string | null;
	occurred_at: string;
	created_at: string;
}

export interface OverviewTransaction {
	id: number;
	type: TransactionType;
	amount: string;
	account_name: string;
	to_account_name: string | null;
	category_name: string | null;
	description: string | null;
	occurred_at: string;
}

export interface OverviewMonth {
	income: string;
	expense: string;
	balance: string;
}

export interface Overview {
	accounts_total: string;
	month: OverviewMonth;
	previous_month: OverviewMonth;
	recent_transactions: OverviewTransaction[];
}

export interface CreateAccountRequest {
	name: string;
}

export interface UpdateAccountRequest {
	name: string;
}

export interface CreateCategoryRequest {
	name: string;
	parent_id?: number | null;
	type: TransactionType;
}

export interface UpdateCategoryRequest {
	name: string;
	parent_id: number | null;
	type: TransactionType;
}

export interface CreateTransactionRequest {
	type: TransactionType;
	amount: string;
	account_id: number;
	to_account_id?: number | null;
	category_id: number;
	description?: string | null;
	occurred_at?: string;
}

export interface UpdateTransactionRequest {
	type: TransactionType;
	amount: string;
	account_id: number;
	to_account_id?: number | null;
	category_id: number;
	description?: string | null;
	occurred_at: string;
}

export type StatsGranularity = 'day' | 'week' | 'month';

export interface NetWorthPoint {
	date: string;
	total: string;
}

export interface CategoryStat {
	category_id: number | null;
	name: string;
	amount: string;
	share: number;
	tx_count: number;
}

export interface MonthlyStat {
	month: string;
	income: string;
	expense: string;
	balance: string;
}

export interface StatsRangeSummary {
	income: string;
	expense: string;
	balance: string;
	savings_rate: number;
}

export interface StatsFilters {
	from?: string;
	to?: string;
	granularity?: StatsGranularity;
	type?: 'income' | 'expense';
	account_id?: number | null;
	category_id?: number | null;
}
