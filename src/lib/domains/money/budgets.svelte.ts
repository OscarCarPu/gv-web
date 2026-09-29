import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { formatMoney } from '$lib/shared/utils/money';
import { currentMonth, formatMonth, shiftMonth } from '$lib/domains/money/utils/budgetMonth';
import type {
	BudgetItem,
	BudgetMonth,
	BudgetPeriod,
	OverviewTransaction,
} from '$lib/domains/money/types/Money.types';

const FOLD_LIMIT = 15;
const EXPAND_STEP = 10;

export interface MoneyBudgetsApi {
	getBudgetTransactions: (
		categoryId: number,
		params: { month: string; period: BudgetPeriod }
	) => Promise<OverviewTransaction[]>;
}

function runningPace(progress: number): number | null {
	return progress > 0 && progress < 1 ? progress : null;
}

function groupByType(items: BudgetItem[]): BudgetGroup[] {
	return [
		{ type: 'expense', label: 'Expenses', items: items.filter((i) => i.type === 'expense') },
		{ type: 'income', label: 'Income', items: items.filter((i) => i.type === 'income') },
	];
}

function signedMoney(n: number): string {
	return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatMoney(Math.abs(n).toFixed(2))}`;
}

interface BudgetGroup {
	type: 'expense' | 'income';
	label: string;
	items: BudgetItem[];
}

/**
 * Owns the budgets page's view state: month navigation (the month lives in the URL, so
 * this only derives the neighbours), the grouped monthly and yearly rows, the balances, the
 * create/edit sheet, and the expanded row with the transactions its budget counted. The
 * `BudgetMonth` comes from the SSR loader and is injected as a getter so the controller reads
 * live data after `invalidateAll`.
 */
export class MoneyBudgets {
	#getData: () => BudgetMonth;
	#api: MoneyBudgetsApi;

	sheetOpen = $state(false);
	editing = $state<BudgetItem | null>(null);

	// The expanded row, keyed with the month so navigating collapses it.
	#expandedKey = $state<string | null>(null);
	#transactions = $state<Record<string, OverviewTransaction[]>>({});
	#loadingKey = $state<string | null>(null);
	visibleCount = $state(FOLD_LIMIT);

	constructor(getData: () => BudgetMonth, api: MoneyBudgetsApi = moneyApi) {
		this.#getData = getData;
		this.#api = api;
	}

	#key(item: BudgetItem): string {
		return `${this.month}:${item.period}:${item.category_id}`;
	}

	isExpanded(item: BudgetItem): boolean {
		return this.#expandedKey === this.#key(item);
	}

	isLoading(item: BudgetItem): boolean {
		return this.#loadingKey === this.#key(item);
	}

	/** Everything loaded for the row (cached from a previous expand until the refetch lands). */
	transactionsOf(item: BudgetItem): OverviewTransaction[] {
		return this.#transactions[this.#key(item)] ?? [];
	}

	visibleTransactionsOf(item: BudgetItem): OverviewTransaction[] {
		return this.transactionsOf(item).slice(0, this.visibleCount);
	}

	remainingOf(item: BudgetItem): number {
		return Math.max(this.transactionsOf(item).length - this.visibleCount, 0);
	}

	showMore(item: BudgetItem): void {
		this.visibleCount = Math.min(this.visibleCount + EXPAND_STEP, this.transactionsOf(item).length);
	}

	/** Expand a row and (re)load its transactions, or collapse it if it was open. */
	async toggle(item: BudgetItem): Promise<void> {
		const key = this.#key(item);
		if (this.#expandedKey === key) {
			this.#expandedKey = null;
			return;
		}
		this.#expandedKey = key;
		this.visibleCount = FOLD_LIMIT;
		this.#loadingKey = key;
		try {
			const list = await this.#api.getBudgetTransactions(item.category_id, {
				month: this.month,
				period: item.period,
			});
			this.#transactions = { ...this.#transactions, [key]: list };
		} catch {
			addToast('Error loading transactions', 'error');
		} finally {
			if (this.#loadingKey === key) this.#loadingKey = null;
		}
	}

	get month(): string {
		return this.#getData().month;
	}

	get label(): string {
		return formatMonth(this.month);
	}

	get prevMonth(): string {
		return shiftMonth(this.month, -1);
	}

	get nextMonth(): string {
		return shiftMonth(this.month, 1);
	}

	get isCurrent(): boolean {
		return this.month === currentMonth();
	}

	/** The pace marker only means something while the month is running. */
	get pace(): number | null {
		return runningPace(this.#getData().month_progress);
	}

	/** Same for the yearly budgets, against the year. */
	get yearPace(): number | null {
		return runningPace(this.#getData().yearly.year_progress);
	}

	get year(): string {
		return this.#getData().yearly.year;
	}

	get groups(): BudgetGroup[] {
		return groupByType(this.#getData().items);
	}

	get yearlyGroups(): BudgetGroup[] {
		return groupByType(this.#getData().yearly.items);
	}

	get hasYearly(): boolean {
		return this.#getData().yearly.items.length > 0;
	}

	get isEmpty(): boolean {
		return this.#getData().items.length === 0 && !this.hasYearly;
	}

	/** Planned monthly balance, yearly budgets included pro rata (from the API). */
	get forecast(): number {
		return parseFloat(this.#getData().planned_balance);
	}

	get forecastLabel(): string {
		return signedMoney(this.forecast);
	}

	/** Actual income − actual expenses so far this month. */
	get balance(): number {
		const d = this.#getData();
		return parseFloat(d.income.actual) - parseFloat(d.expense.actual);
	}

	get balanceLabel(): string {
		return signedMoney(this.balance);
	}

	/** Expenses outside the plan: spent in unbudgeted categories + spent over budgets. */
	get offBudget(): number {
		const e = this.#getData().expense;
		return parseFloat(e.unbudgeted) + parseFloat(e.overspent);
	}

	openCreate(): void {
		this.editing = null;
		this.sheetOpen = true;
	}

	openEdit(item: BudgetItem): void {
		this.editing = item;
		this.sheetOpen = true;
	}

	closeSheet(): void {
		this.sheetOpen = false;
	}
}
