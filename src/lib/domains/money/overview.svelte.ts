import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { deriveOverviewKpis, type OverviewKpis } from '$lib/domains/money/utils/money';
import type {
	Overview,
	OverviewTransaction,
	Transaction,
} from '$lib/domains/money/types/Money.types';

const FOLD_LIMIT = 15;
const EXPAND_STEP = 10;

export type StatsSheet = 'netWorth' | 'categoryBreakdown' | 'monthlyTrend' | 'estimation';

export interface MoneyOverviewApi {
	listTransactions: () => Promise<Transaction[]>;
	deleteTransaction: (id: number) => Promise<void>;
}

export interface MoneyOverviewCallbacks {
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
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

	// Recent-transactions fold state.
	visibleCount = $state(FOLD_LIMIT);

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
		{ refresh }: MoneyOverviewCallbacks,
		api: MoneyOverviewApi = moneyApi
	) {
		this.#getOverview = getOverview;
		this.#refresh = refresh;
		this.#api = api;
	}

	// ── derived view-state (getters: reactive when read in templates) ────────

	get kpis(): OverviewKpis {
		return deriveOverviewKpis(this.#getOverview());
	}

	get visible(): OverviewTransaction[] {
		return this.#getOverview().recent_transactions.slice(0, this.visibleCount);
	}

	get hasMore(): boolean {
		return this.visibleCount < this.#getOverview().recent_transactions.length;
	}

	get remaining(): number {
		return this.#getOverview().recent_transactions.length - this.visibleCount;
	}

	// ── folding ──────────────────────────────────────────────────────────────

	showMore(): void {
		this.visibleCount = Math.min(
			this.visibleCount + EXPAND_STEP,
			this.#getOverview().recent_transactions.length
		);
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
		} catch {
			addToast('Error deleting transaction', 'error');
		}
	}
}
