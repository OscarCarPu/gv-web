import { moneyApi } from '$lib/domains/money/api/money.api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const token = cookies.get('session');

	const [overview, accounts, categories] = await Promise.all([
		moneyApi.getOverview(token).catch((error) => {
			console.error('Failed to load overview:', error);
			return {
				accounts_total: '0.00',
				month: { income: '0.00', expense: '0.00', balance: '0.00' },
				previous_month: { income: '0.00', expense: '0.00', balance: '0.00' },
				recent_transactions: [],
			};
		}),
		moneyApi.listAccounts(token).catch((error) => {
			console.error('Failed to load accounts:', error);
			return [];
		}),
		moneyApi.listCategories(token).catch((error) => {
			console.error('Failed to load categories:', error);
			return [];
		}),
	]);

	return { overview, accounts, categories };
};
