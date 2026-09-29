import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { buildCategoryOptions, type CategoryOption } from '$lib/domains/money/utils/categoryTree';
import type {
	BudgetAmount,
	BudgetItem,
	BudgetScope,
	Category,
	SetBudgetRequest,
} from '$lib/domains/money/types/Money.types';

export interface BudgetFormApi {
	setBudget: (categoryId: number, input: SetBudgetRequest) => Promise<void>;
	deleteBudget: (
		categoryId: number,
		params: { month: string; scope: BudgetScope }
	) => Promise<void>;
}

interface BudgetFormCallbacks {
	onclose: () => void;
	refresh: () => Promise<void>;
}

interface CategoryOptionGroup {
	label: string;
	options: CategoryOption[];
}

/**
 * Owns `BudgetFormSheet`'s logic: category / amount / scope fields, create-vs-edit
 * seeding, the 3-month average suggestion, and save / remove (then `invalidateAll`).
 * Categories and averages are injected as getters; the month is fixed per `reset`.
 */
export class BudgetForm {
	#api: BudgetFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;
	#getCategories: () => Category[];
	#getAverages: () => BudgetAmount[];

	#item = $state<BudgetItem | null>(null);
	#month = $state('');

	categoryId = $state<number | null>(null);
	amount = $state<string | number>('');
	scope = $state<BudgetScope>('forward');

	saving = $state(false);
	categoryError = $state(false);
	amountError = $state(false);

	constructor(
		getCategories: () => Category[],
		getAverages: () => BudgetAmount[],
		{ onclose, refresh }: BudgetFormCallbacks,
		api: BudgetFormApi = moneyApi
	) {
		this.#getCategories = getCategories;
		this.#getAverages = getAverages;
		this.#onclose = onclose;
		this.#refresh = refresh;
		this.#api = api;
	}

	get item(): BudgetItem | null {
		return this.#item;
	}

	/** Expense and income category trees; transfers can't be budgeted. */
	get categoryGroups(): CategoryOptionGroup[] {
		const cats = this.#getCategories();
		return [
			{
				label: 'Expenses',
				options: buildCategoryOptions(cats.filter((c) => c.type === 'expense')),
			},
			{ label: 'Income', options: buildCategoryOptions(cats.filter((c) => c.type === 'income')) },
		];
	}

	/** Average of the last 3 complete months for the chosen category, if any. */
	get average(): string | null {
		const id = this.categoryId;
		if (id === null) return null;
		return this.#getAverages().find((a) => a.category_id === id)?.amount ?? null;
	}

	reset(item: BudgetItem | null, month: string): void {
		this.#item = item;
		this.#month = month;
		this.categoryId = item?.category_id ?? null;
		this.amount = item ? parseFloat(item.budget) : '';
		this.scope = 'forward';
		this.categoryError = false;
		this.amountError = false;
	}

	useAverage(): void {
		const avg = this.average;
		if (avg !== null) {
			this.amount = parseFloat(avg);
			this.amountError = false;
		}
	}

	async save(): Promise<void> {
		const categoryId = this.categoryId;
		const amount = typeof this.amount === 'number' ? this.amount : parseFloat(this.amount);
		this.categoryError = categoryId === null;
		this.amountError = !Number.isFinite(amount) || amount < 0;
		if (categoryId === null || this.amountError) return;

		this.saving = true;
		try {
			await this.#api.setBudget(categoryId, {
				month: this.#month,
				amount: amount.toFixed(2),
				scope: this.scope,
			});
			addNotification(this.#item ? 'Budget updated' : 'Budget created', 'success');
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error saving budget', 'error');
		} finally {
			this.saving = false;
		}
	}

	async remove(): Promise<void> {
		const item = this.#item;
		if (!item) return;
		this.saving = true;
		try {
			await this.#api.deleteBudget(item.category_id, { month: this.#month, scope: this.scope });
			addNotification('Budget removed', 'success');
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error removing budget', 'error');
		} finally {
			this.saving = false;
		}
	}
}
