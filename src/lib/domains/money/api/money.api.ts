import * as z from 'zod';
import { fetchAPI } from '$lib/shared/api/client';
import {
	AccountSchema,
	AccountListSchema,
	CategorySchema,
	CategoryListSchema,
	TransactionSchema,
	TransactionListSchema,
	OverviewSchema,
	NetWorthSeriesSchema,
	CategoryStatsSchema,
	MonthlyStatsSchema,
	EstimationResultSchema,
} from './money.schemas';
import type {
	Account,
	Category,
	Transaction,
	Overview,
	CreateAccountRequest,
	UpdateAccountRequest,
	CreateCategoryRequest,
	UpdateCategoryRequest,
	CreateTransactionRequest,
	UpdateTransactionRequest,
	NetWorthPoint,
	CategoryStat,
	MonthlyStat,
	StatsGranularity,
	EstimationMode,
	EstimationResult,
} from '../types/Money.types';

export const moneyApi = {
	// --- Overview ---

	async getOverview(token?: string): Promise<Overview> {
		return fetchAPI('/finance/overview', OverviewSchema, { token });
	},

	// --- Accounts ---

	async listAccounts(token?: string): Promise<Account[]> {
		return fetchAPI('/finance/accounts', AccountListSchema, { token });
	},

	async createAccount(input: CreateAccountRequest, token?: string): Promise<Account> {
		return fetchAPI('/finance/accounts', AccountSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateAccount(id: number, input: UpdateAccountRequest, token?: string): Promise<Account> {
		return fetchAPI(`/finance/accounts/${id}`, AccountSchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteAccount(id: number, token?: string): Promise<void> {
		return fetchAPI(`/finance/accounts/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Categories ---

	async listCategories(token?: string): Promise<Category[]> {
		return fetchAPI('/finance/categories', CategoryListSchema, { token });
	},

	async createCategory(input: CreateCategoryRequest, token?: string): Promise<Category> {
		return fetchAPI('/finance/categories', CategorySchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateCategory(
		id: number,
		input: UpdateCategoryRequest,
		token?: string
	): Promise<Category> {
		return fetchAPI(`/finance/categories/${id}`, CategorySchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteCategory(id: number, token?: string): Promise<void> {
		return fetchAPI(`/finance/categories/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Transactions ---

	async listTransactions(accountId?: number, token?: string): Promise<Transaction[]> {
		const qs = accountId ? `?account_id=${accountId}` : '';
		return fetchAPI(`/finance/transactions${qs}`, TransactionListSchema, { token });
	},

	async createTransaction(input: CreateTransactionRequest, token?: string): Promise<Transaction> {
		return fetchAPI('/finance/transactions', TransactionSchema, {
			method: 'POST',
			body: JSON.stringify(input),
			token,
		});
	},

	async updateTransaction(
		id: number,
		input: UpdateTransactionRequest,
		token?: string
	): Promise<Transaction> {
		return fetchAPI(`/finance/transactions/${id}`, TransactionSchema, {
			method: 'PUT',
			body: JSON.stringify(input),
			token,
		});
	},

	async deleteTransaction(id: number, token?: string): Promise<void> {
		return fetchAPI(`/finance/transactions/${id}`, z.void(), {
			method: 'DELETE',
			token,
		});
	},

	// --- Stats ---

	async getNetWorthStats(
		params: { from?: string; to?: string; granularity?: StatsGranularity } = {},
		token?: string
	): Promise<NetWorthPoint[]> {
		const qs = new URLSearchParams();
		if (params.from) qs.set('from', params.from);
		if (params.to) qs.set('to', params.to);
		if (params.granularity) qs.set('granularity', params.granularity);
		const suffix = qs.toString() ? `?${qs}` : '';
		return fetchAPI(`/finance/stats/networth${suffix}`, NetWorthSeriesSchema, { token });
	},

	async getCategoryStats(
		params: {
			type?: 'income' | 'expense' | 'transfer';
			from?: string;
			to?: string;
			account_id?: number | null;
		} = {},
		token?: string
	): Promise<CategoryStat[]> {
		const qs = new URLSearchParams();
		if (params.type) qs.set('type', params.type);
		if (params.from) qs.set('from', params.from);
		if (params.to) qs.set('to', params.to);
		if (params.account_id != null) qs.set('account_id', String(params.account_id));
		const suffix = qs.toString() ? `?${qs}` : '';
		return fetchAPI(`/finance/stats/by-category${suffix}`, CategoryStatsSchema, { token });
	},

	async getMonthlyStats(
		params: {
			from?: string;
			to?: string;
			account_id?: number | null;
			category_id?: number | null;
		} = {},
		token?: string
	): Promise<MonthlyStat[]> {
		const qs = new URLSearchParams();
		if (params.from) qs.set('from', params.from);
		if (params.to) qs.set('to', params.to);
		if (params.account_id != null) qs.set('account_id', String(params.account_id));
		if (params.category_id != null) qs.set('category_id', String(params.category_id));
		const suffix = qs.toString() ? `?${qs}` : '';
		return fetchAPI(`/finance/stats/monthly${suffix}`, MonthlyStatsSchema, { token });
	},

	async getEstimation(
		params: {
			start_month: string;
			end_month: string;
			mode: EstimationMode;
		},
		token?: string
	): Promise<EstimationResult> {
		const qs = new URLSearchParams();
		qs.set('start_month', params.start_month);
		qs.set('end_month', params.end_month);
		qs.set('mode', params.mode);
		return fetchAPI(`/finance/stats/estimation?${qs}`, EstimationResultSchema, { token });
	},
};
