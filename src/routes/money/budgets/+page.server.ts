import { moneyApi } from '$lib/domains/money/api/money.api';
import { currentMonth, isBudgetMonth } from '$lib/domains/money/utils/budgetMonth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const token = cookies.get('session');
	const param = url.searchParams.get('month');
	const month = isBudgetMonth(param) ? param : currentMonth();

	const [budgets, categories] = await Promise.all([
		moneyApi.getBudgets(month, token).catch((error) => {
			console.error('Failed to load budgets:', error);
			const zero = { budgeted: '0.00', actual: '0.00', unbudgeted: '0.00', overspent: '0.00' };
			return {
				month,
				month_progress: 0,
				expense: zero,
				income: zero,
				items: [],
				planned_balance: '0.00',
				yearly: {
					year: month.slice(0, 4),
					year_progress: 0,
					expense: zero,
					income: zero,
					items: [],
				},
				averages: [],
				previous_year: [],
			};
		}),
		moneyApi.listCategories(token).catch((error) => {
			console.error('Failed to load categories:', error);
			return [];
		}),
	]);

	return { budgets, categories };
};
