import { formatMoney } from '$lib/shared/utils/money';
import { currentMonth, formatMonth, shiftMonth } from '$lib/domains/money/utils/budgetMonth';
import type { BudgetItem, BudgetMonth } from '$lib/domains/money/types/Money.types';

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
 * this only derives the neighbours), the grouped monthly and yearly rows, the balances, and
 * the create/edit sheet. The `BudgetMonth` comes from the SSR loader and is injected as a
 * getter so the controller reads live data after `invalidateAll`.
 */
export class MoneyBudgets {
	#getData: () => BudgetMonth;

	sheetOpen = $state(false);
	editing = $state<BudgetItem | null>(null);

	constructor(getData: () => BudgetMonth) {
		this.#getData = getData;
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
