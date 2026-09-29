import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	currentMonth,
	formatMonth,
	isBudgetMonth,
	shiftMonth,
} from '$lib/domains/money/utils/budgetMonth';
import type { BudgetFormApi } from '$lib/domains/money/forms/budgetForm.svelte';
import type { BudgetItem, BudgetMonth, Category } from '$lib/domains/money/types/Money.types';

function item(over: Partial<BudgetItem> & { category_id: number; name: string }): BudgetItem {
	return {
		period: 'monthly',
		parent_id: null,
		type: 'expense',
		depth: 0,
		budget: '100',
		actual: '50',
		remaining: '50',
		progress: 0.5,
		status: 'ok',
		since: '2026-01',
		...over,
	};
}

function month(over: Partial<BudgetMonth> = {}): BudgetMonth {
	return {
		month: '2026-03',
		month_progress: 0.5,
		expense: { budgeted: '500', actual: '400', unbudgeted: '30', overspent: '20.5' },
		income: { budgeted: '2000', actual: '1800', unbudgeted: '0', overspent: '0' },
		items: [],
		planned_balance: '1500.00',
		yearly: {
			year: '2026',
			year_progress: 0.2,
			expense: { budgeted: '950', actual: '425', unbudgeted: '0', overspent: '0' },
			income: { budgeted: '0', actual: '0', unbudgeted: '0', overspent: '0' },
			items: [],
		},
		averages: [],
		previous_year: [],
		...over,
	};
}

function cat(over: Partial<Category> & { id: number; name: string }): Category {
	return { parent_id: null, type: 'expense', created_at: '2026-01-01T00:00:00Z', ...over };
}

describe('budgetMonth utils', () => {
	it('validates YYYY-MM', () => {
		expect(isBudgetMonth('2026-09')).toBe(true);
		expect(isBudgetMonth('2026-13')).toBe(false);
		expect(isBudgetMonth('2026-9')).toBe(false);
		expect(isBudgetMonth(null)).toBe(false);
	});

	it('shifts across years', () => {
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		expect(shiftMonth('2026-01', -1)).toBe('2025-12');
		expect(shiftMonth('2026-03', 0)).toBe('2026-03');
	});

	it('formats the current month and labels', () => {
		expect(currentMonth(new Date(2026, 8, 30))).toBe('2026-09');
		expect(formatMonth('2026-09')).toBe('September 2026');
		expect(formatMonth('2026-09', true)).toBe('Sep 2026');
	});
});

describe('MoneyBudgets', () => {
	let MoneyBudgets: typeof import('$lib/domains/money/budgets.svelte').MoneyBudgets;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 10, 12));
		MoneyBudgets = (await import('$lib/domains/money/budgets.svelte')).MoneyBudgets;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('derives the neighbouring months and whether it is the current one', () => {
		const c = new MoneyBudgets(() => month());
		expect(c.prevMonth).toBe('2026-02');
		expect(c.nextMonth).toBe('2026-04');
		expect(c.isCurrent).toBe(true);
		expect(c.label).toBe('March 2026');
		expect(new MoneyBudgets(() => month({ month: '2026-01' })).isCurrent).toBe(false);
	});

	it('only exposes a pace marker while the month is running', () => {
		expect(new MoneyBudgets(() => month({ month_progress: 0.4 })).pace).toBe(0.4);
		expect(new MoneyBudgets(() => month({ month_progress: 1 })).pace).toBeNull();
		expect(new MoneyBudgets(() => month({ month_progress: 0 })).pace).toBeNull();
	});

	it('groups items by type, expenses first', () => {
		const c = new MoneyBudgets(() =>
			month({
				items: [
					item({ category_id: 1, name: 'Salary', type: 'income' }),
					item({ category_id: 2, name: 'Food' }),
				],
			})
		);
		expect(c.groups.map((g) => [g.type, g.items.map((i) => i.name)])).toEqual([
			['expense', ['Food']],
			['income', ['Salary']],
		]);
		expect(c.isEmpty).toBe(false);
	});

	it('computes planned and real balance and the off-budget sum', () => {
		const c = new MoneyBudgets(() => month({ planned_balance: '1420.83' }));
		expect(c.forecast).toBe(1420.83);
		expect(c.balance).toBe(1400);
		expect(c.balanceLabel.startsWith('+')).toBe(true);
		expect(c.offBudget).toBeCloseTo(50.5);

		const negative = new MoneyBudgets(() =>
			month({ income: { budgeted: '0', actual: '0', unbudgeted: '0', overspent: '0' } })
		);
		expect(negative.balanceLabel.startsWith('−')).toBe(true);
	});

	it('exposes the yearly section with its own pace', () => {
		const empty = new MoneyBudgets(() => month());
		expect(empty.hasYearly).toBe(false);
		expect(empty.isEmpty).toBe(true);

		const base = month();
		const c = new MoneyBudgets(() =>
			month({
				yearly: {
					...base.yearly,
					items: [item({ category_id: 9, name: 'IBI', period: 'yearly', since: '2025' })],
				},
			})
		);
		expect(c.hasYearly).toBe(true);
		expect(c.isEmpty).toBe(false);
		expect(c.year).toBe('2026');
		expect(c.yearPace).toBe(0.2);
		expect(c.yearlyGroups[0].items.map((i) => i.name)).toEqual(['IBI']);
	});

	it('opens the sheet for create and edit', () => {
		const c = new MoneyBudgets(() => month());
		const food = item({ category_id: 2, name: 'Food' });
		c.openEdit(food);
		expect(c.sheetOpen).toBe(true);
		expect(c.editing).toEqual(food);
		c.openCreate();
		expect(c.editing).toBeNull();
		c.closeSheet();
		expect(c.sheetOpen).toBe(false);
	});
});

describe('BudgetForm', () => {
	let BudgetForm: typeof import('$lib/domains/money/forms/budgetForm.svelte').BudgetForm;
	let api: BudgetFormApi & {
		setBudget: ReturnType<typeof vi.fn>;
		deleteBudget: ReturnType<typeof vi.fn>;
	};
	let onclose: ReturnType<typeof vi.fn>;
	let refresh: ReturnType<typeof vi.fn>;

	const CATEGORIES = [
		cat({ id: 1, name: 'Food' }),
		cat({ id: 2, name: 'Groceries', parent_id: 1 }),
		cat({ id: 3, name: 'Salary', type: 'income' }),
		cat({ id: 4, name: 'Savings', type: 'transfer' }),
	];

	function make() {
		return new BudgetForm(
			() => CATEGORIES,
			() => ({
				averages: [{ category_id: 1, amount: '372.10' }],
				previous_year: [{ category_id: 1, amount: '4400.00' }],
			}),
			{
				onclose: onclose as unknown as () => void,
				refresh: refresh as unknown as () => Promise<void>,
			},
			api
		);
	}

	beforeEach(async () => {
		BudgetForm = (await import('$lib/domains/money/forms/budgetForm.svelte')).BudgetForm;
		api = {
			setBudget: vi.fn().mockResolvedValue(undefined),
			deleteBudget: vi.fn().mockResolvedValue(undefined),
		};
		onclose = vi.fn();
		refresh = vi.fn().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.resetModules();
	});

	it('offers expense and income categories only, as trees', () => {
		const f = make();
		expect(f.categoryGroups.map((g) => [g.label, g.options.map((o) => o.id)])).toEqual([
			['Expenses', [1, 2]],
			['Income', [3]],
		]);
	});

	it('suggests the 3-month average, or last year for a yearly budget', () => {
		const f = make();
		f.reset(null, '2026-03');
		expect(f.suggestion).toBeNull();
		f.categoryId = 1;
		expect(f.suggestion).toBe('372.10');
		f.useSuggestion();
		expect(f.amount).toBe(372.1);
		f.period = 'yearly';
		expect(f.suggestion).toBe('4400.00');
	});

	it('validates before saving', async () => {
		const f = make();
		f.reset(null, '2026-03');
		await f.save();
		expect(f.categoryError).toBe(true);
		f.categoryId = 1;
		f.amount = -5;
		await f.save();
		expect(f.amountError).toBe(true);
		expect(api.setBudget).not.toHaveBeenCalled();
	});

	it('saves with the month and scope, then closes and refreshes', async () => {
		const f = make();
		f.reset(null, '2026-03');
		f.categoryId = 1;
		f.amount = 400;
		f.scope = 'once';
		await f.save();
		expect(api.setBudget).toHaveBeenCalledWith(1, {
			month: '2026-03',
			amount: '400.00',
			scope: 'once',
			period: 'monthly',
		});
		expect(onclose).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});

	it('seeds from an item and removes it with the chosen scope', async () => {
		const f = make();
		f.reset(item({ category_id: 1, name: 'Food', budget: '250.00' }), '2026-03');
		expect(f.categoryId).toBe(1);
		expect(f.amount).toBe(250);
		expect(f.scope).toBe('forward');
		await f.remove();
		expect(api.deleteBudget).toHaveBeenCalledWith(1, {
			month: '2026-03',
			scope: 'forward',
			period: 'monthly',
		});
		expect(refresh).toHaveBeenCalled();
	});

	it('keeps the period of the budget being edited', async () => {
		const f = make();
		f.reset(item({ category_id: 1, name: 'IBI', period: 'yearly', budget: '450' }), '2026-03');
		expect(f.period).toBe('yearly');
		await f.save();
		expect(api.setBudget).toHaveBeenCalledWith(1, {
			month: '2026-03',
			amount: '450.00',
			scope: 'forward',
			period: 'yearly',
		});
	});
});
