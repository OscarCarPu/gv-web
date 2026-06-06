import { untrack } from 'svelte';
import { moneyApi } from '$lib/domains/money/api/money.api';
import { StatsResource } from './statsResource.svelte';
import {
	buildCategoryStatTree,
	flattenCategoryStatTree,
	type CategoryStatNode,
	type CategoryStatRow,
} from '../utils/categoryTree';
import { amountClass, amountPrefix } from '../utils/transactionType';
import { currentMonth, monthBounds } from '../utils/statsDate';
import type {
	Account,
	Category,
	CategoryStat,
	OverviewTransaction,
	Transaction,
	TransactionType,
} from '../types/Money.types';

export interface CategoryBreakdownApi {
	getCategoryStats: (params: {
		type?: TransactionType;
		from?: string;
		to?: string;
	}) => Promise<CategoryStat[]>;
	listTransactions: (params: {
		categoryId?: number;
		type?: TransactionType;
		from?: string;
		to?: string;
	}) => Promise<Transaction[]>;
}

/**
 * Owns CategoryBreakdownSheet's interactive state: the type/month toggles, the
 * expanded set, the stats fetch, and the drill-down (open a category → fetch its
 * transactions). The tree math is pure (`buildCategoryStatTree` / `flatten…`); this
 * class only holds reactive state and composes two `StatsResource`s — one for the
 * category stats, one for the drill-down transaction list.
 *
 * `categories` / `accounts` are injected as getters so the controller reads the
 * sheet's live props. Derived view-state is exposed via `get` accessors (reactive
 * in templates) per the "used before its initialization" lesson.
 */
export class CategoryBreakdown {
	type = $state<TransactionType>('expense');
	selectedMonth = $state(currentMonth());
	selectedNode = $state<CategoryStatNode | null>(null);
	expanded = $state<Record<number, true>>({});

	readonly stats: StatsResource<
		{ type: TransactionType; from: string; to: string },
		CategoryStat[]
	>;
	readonly drill: StatsResource<
		{ categoryId: number; type: TransactionType; from: string; to: string },
		Transaction[]
	>;

	#getCategories: () => Category[];
	#getAccounts: () => Account[];

	constructor(
		getCategories: () => Category[],
		getAccounts: () => Account[],
		api: CategoryBreakdownApi = moneyApi
	) {
		this.#getCategories = getCategories;
		this.#getAccounts = getAccounts;
		this.stats = new StatsResource({
			fetcher: (p) => api.getCategoryStats(p),
			empty: [] as CategoryStat[],
		});
		this.drill = new StatsResource({
			fetcher: (p) => api.listTransactions(p),
			empty: [] as Transaction[],
		});
	}

	// ── params (getters, register reactive deps when read in the open $effect) ──

	get statsParams(): { type: TransactionType; from: string; to: string } {
		const { from, to } = monthBounds(this.selectedMonth);
		return { type: this.type, from, to };
	}

	// ── derived view-state ──────────────────────────────────────────────

	get tree(): CategoryStatNode[] {
		return buildCategoryStatTree(this.#getCategories(), this.stats.data, this.type);
	}

	get total(): number {
		return this.tree.reduce((s, n) => s + n.totalAmount, 0);
	}

	get totalTx(): number {
		return this.tree.reduce((s, n) => s + n.totalCount, 0);
	}

	get rootMax(): number {
		return Math.max(0.01, ...this.tree.map((n) => n.totalAmount));
	}

	get flatRows(): CategoryStatRow[] {
		return flattenCategoryStatTree(this.tree, this.expanded, this.total, this.rootMax);
	}

	get sign(): string {
		return amountPrefix(this.type);
	}

	get amountClass(): string {
		return amountClass(this.type);
	}

	get txLoading(): boolean {
		return this.drill.initialLoading;
	}

	get detailRows(): OverviewTransaction[] {
		const accountById = Object.fromEntries(this.#getAccounts().map((a) => [a.id, a.name]));
		const categoryById = Object.fromEntries(this.#getCategories().map((c) => [c.id, c.name]));
		return this.drill.data.map((tx) => ({
			id: tx.id,
			type: tx.type,
			amount: tx.amount,
			account_name: accountById[tx.account_id] ?? '',
			to_account_name: tx.to_account_id != null ? (accountById[tx.to_account_id] ?? null) : null,
			category_name: tx.category_id != null ? (categoryById[tx.category_id] ?? null) : null,
			description: tx.description,
			occurred_at: tx.occurred_at,
		}));
	}

	// ── interactions ────────────────────────────────────────────────────

	setType(value: TransactionType): void {
		this.type = value;
	}

	toggle(id: number): void {
		const next: Record<number, true> = { ...this.expanded };
		if (next[id]) delete next[id];
		else next[id] = true;
		this.expanded = next;
	}

	/** Load the category stats for the current type/month. */
	loadStats(): Promise<void> {
		return this.stats.load(this.statsParams);
	}

	/** Drill into a category: show its transactions for the selected month. */
	async openCategory(node: CategoryStatNode): Promise<void> {
		this.selectedNode = node;
		this.drill.resetForClose(); // categoryTx = [] + txLoading = true
		const { from, to } = monthBounds(this.selectedMonth);
		await this.drill.load({ categoryId: node.category.id, type: this.type, from, to });
	}

	/** Return to the tree list. */
	back(): void {
		this.selectedNode = null;
		this.drill.data = [];
	}

	/** Reset everything to a clean slate for the next open. */
	resetForClose(): void {
		this.stats.resetForClose();
		this.selectedMonth = currentMonth();
		this.selectedNode = null;
		this.drill.data = [];
	}
}
