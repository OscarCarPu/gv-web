import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { deriveOverviewKpis, type OverviewKpis } from '$lib/domains/money/utils/money';
import type {
	Account,
	Category,
	Overview,
	OverviewTransaction,
	Transaction,
} from '$lib/domains/money/types/Money.types';

const FOLD_LIMIT = 15;
const EXPAND_STEP = 10;

export type StatsSheet = 'netWorth' | 'categoryBreakdown' | 'monthlyTrend' | 'estimation';

export interface MoneyOverviewApi {
	listTransactions: (params?: { accountId?: number }) => Promise<Transaction[]>;
	deleteTransaction: (id: number) => Promise<void>;
}

export interface MoneyOverviewCallbacks {
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
	/** Live accounts list — used to resolve account names in the account-history view. */
	getAccounts?: () => Account[];
	/** Live categories list — used to resolve category names in the account-history view. */
	getCategories?: () => Category[];
}

/**
 * Owns `OverviewCard`'s non-presentational logic: the recent-transactions folding,
 * the transaction create/edit sheet state (incl. the list-then-find edit fetch with
 * a `loadingEdit` guard), delete + `invalidateAll`, and the four stats-sheet booleans
 * (driven by `openSheet` / `closeSheet`). The `overview` prop is injected as a getter
 * so the controller reads live SSR data; the KPI math is the pure
 * `deriveOverviewKpis` exposed via a getter.
 */
export class MoneyOverview {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#getOverview: () => Overview;
	#refresh: () => Promise<void>;
	#api: MoneyOverviewApi;
	#getAccounts: () => Account[];
	#getCategories: () => Category[];

	// Recent-transactions fold state.
	visibleCount = $state(FOLD_LIMIT);

	// Account-history filter: null = recent transactions (last 30 days, from SSR
	// overview); a number = that account's full history (client-fetched, name-mapped).
	selectedAccountId = $state<number | null>(null);
	accountHistory = $state<OverviewTransaction[]>([]);
	loadingHistory = $state(false);

	// Transaction create/edit sheet state.
	sheetOpen = $state(false);
	editingTx = $state<Transaction | null>(null);
	loadingEdit = $state(false);

	// Stats sheets.
	netWorthOpen = $state(false);
	categoryBreakdownOpen = $state(false);
	monthlyTrendOpen = $state(false);
	estimationOpen = $state(false);

	constructor(
		getOverview: () => Overview,
		{ refresh, getAccounts, getCategories }: MoneyOverviewCallbacks,
		api: MoneyOverviewApi = moneyApi
	) {
		this.#getOverview = getOverview;
		this.#refresh = refresh;
		this.#api = api;
		this.#getAccounts = getAccounts ?? (() => []);
		this.#getCategories = getCategories ?? (() => []);
	}

	// ── derived view-state (getters: reactive when read in templates) ────────

	get kpis(): OverviewKpis {
		return deriveOverviewKpis(this.#getOverview());
	}

	/** Active transaction list: account history when filtering, else recent (SSR). */
	get source(): OverviewTransaction[] {
		return this.filtering ? this.accountHistory : this.#getOverview().recent_transactions;
	}

	get filtering(): boolean {
		return this.selectedAccountId !== null;
	}

	get visible(): OverviewTransaction[] {
		return this.source.slice(0, this.visibleCount);
	}

	get hasMore(): boolean {
		return this.visibleCount < this.source.length;
	}

	get remaining(): number {
		return this.source.length - this.visibleCount;
	}

	// ── folding ──────────────────────────────────────────────────────────────

	showMore(): void {
		this.visibleCount = Math.min(this.visibleCount + EXPAND_STEP, this.source.length);
	}

	// ── account-history filter ───────────────────────────────────────────────

	/** Switch the list to an account's full history (or back to recent when null). */
	async selectAccount(id: number | null): Promise<void> {
		this.selectedAccountId = id;
		this.visibleCount = FOLD_LIMIT;
		await this.#loadHistory();
	}

	/** (Re)fetch the selected account's history, preserving the current fold. */
	async #loadHistory(): Promise<void> {
		const id = this.selectedAccountId;
		if (id === null) {
			this.accountHistory = [];
			return;
		}
		this.loadingHistory = true;
		try {
			const list = await this.#api.listTransactions({ accountId: id });
			this.accountHistory = list.map((t) => this.#toOverviewTx(t));
		} catch {
			addToast('Error loading account history', 'error');
			this.accountHistory = [];
		} finally {
			this.loadingHistory = false;
		}
	}

	/** Map an id-based Transaction to the name-based shape `TransactionRow` renders. */
	#toOverviewTx(t: Transaction): OverviewTransaction {
		const accountName = (id: number | null): string | null =>
			id === null ? null : (this.#getAccounts().find((a) => a.id === id)?.name ?? null);
		const categoryName = (id: number | null): string | null =>
			id === null ? null : (this.#getCategories().find((c) => c.id === id)?.name ?? null);
		return {
			id: t.id,
			type: t.type,
			amount: t.amount,
			account_name: accountName(t.account_id) ?? '—',
			to_account_name: accountName(t.to_account_id),
			category_name: categoryName(t.category_id),
			description: t.description,
			occurred_at: t.occurred_at,
		};
	}

	// ── stats sheets ───────────────────────────────────────────────────────

	openSheet(name: StatsSheet): void {
		if (name === 'netWorth') this.netWorthOpen = true;
		else if (name === 'categoryBreakdown') this.categoryBreakdownOpen = true;
		else if (name === 'monthlyTrend') this.monthlyTrendOpen = true;
		else this.estimationOpen = true;
	}

	closeSheet(name: StatsSheet): void {
		if (name === 'netWorth') this.netWorthOpen = false;
		else if (name === 'categoryBreakdown') this.categoryBreakdownOpen = false;
		else if (name === 'monthlyTrend') this.monthlyTrendOpen = false;
		else this.estimationOpen = false;
	}

	// ── transaction create / edit / delete ──────────────────────────────────

	openCreate(): void {
		this.editingTx = null;
		this.sheetOpen = true;
	}

	closeForm(): void {
		this.sheetOpen = false;
		// A create/edit may have changed the filtered account's transactions.
		if (this.filtering) void this.#loadHistory();
	}

	/** Edit a transaction: fetch the full list, find it, open the sheet (guarded). */
	async openEdit(id: number): Promise<void> {
		if (this.loadingEdit) return;
		this.loadingEdit = true;
		try {
			const list = await this.#api.listTransactions();
			const found = list.find((t) => t.id === id) ?? null;
			if (!found) {
				addToast('Transaction not found', 'error');
				return;
			}
			this.editingTx = found;
			this.sheetOpen = true;
		} catch {
			addToast('Error loading transaction', 'error');
		} finally {
			this.loadingEdit = false;
		}
	}

	async deleteTransaction(id: number): Promise<void> {
		try {
			await this.#api.deleteTransaction(id);
			addNotification('Transaction deleted', 'success');
			await this.#refresh();
			if (this.filtering) await this.#loadHistory();
		} catch {
			addToast('Error deleting transaction', 'error');
		}
	}
}
