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

export type EstimationMode = 'rate' | 'saving';

export interface EstimationPoint {
	date: string;
	total: string;
	estimated: boolean;
}

export interface EstimationResult {
	points: EstimationPoint[];
	rate: string;
	saving: string;
}

// --- Budgets ---

/** What a budget is measured against: one calendar month or one calendar year. */
export type BudgetPeriod = 'monthly' | 'yearly';

/** How far a budget change reaches: this period and every later one, or this period only. */
export type BudgetScope = 'forward' | 'once';

export type BudgetStatus = 'ok' | 'warning' | 'over' | 'pending' | 'met';

export interface BudgetTotals {
	budgeted: string;
	actual: string;
	/** Actual in categories no budget covers (incl. uncategorized). */
	unbudgeted: string;
	/** Expense beyond the budgets, nested budgets counted once (0 for income). */
	overspent: string;
}

export interface BudgetItem {
	category_id: number;
	period: BudgetPeriod;
	name: string;
	parent_id: number | null;
	type: 'income' | 'expense';
	/** Number of budgeted ancestors of the same type (for nesting). */
	depth: number;
	budget: string;
	actual: string;
	remaining: string;
	progress: number;
	status: BudgetStatus;
	/** Period the budget in effect started: `YYYY-MM` (monthly) or `YYYY` (yearly). */
	since: string;
}

export interface BudgetAmount {
	category_id: number;
	amount: string;
}

export interface BudgetYear {
	/** `YYYY`. */
	year: string;
	/** Elapsed share of the year. */
	year_progress: number;
	/** Yearly budgets only: `actual` is what their categories took this year. */
	expense: BudgetTotals;
	income: BudgetTotals;
	items: BudgetItem[];
}

export interface BudgetMonth {
	/** `YYYY-MM`. */
	month: string;
	/** Elapsed share of the month: 1 past, 0 future, in between for the current one. */
	month_progress: number;
	expense: BudgetTotals;
	income: BudgetTotals;
	items: BudgetItem[];
	/** Monthly budgeted net plus a twelfth of the yearly budgeted net. */
	planned_balance: string;
	/** Yearly budgets of the year containing `month`. */
	yearly: BudgetYear;
	/** Average of the last 3 complete months per category (subtree), to suggest monthly budgets. */
	averages: BudgetAmount[];
	/** Previous calendar year's total per category (subtree), to suggest yearly budgets. */
	previous_year: BudgetAmount[];
}

export interface SetBudgetRequest {
	/** `YYYY-MM`; for a yearly budget only the year is used. */
	month: string;
	amount: string;
	scope: BudgetScope;
	period: BudgetPeriod;
}
