import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TransactionFormApi } from '$lib/domains/money/forms/transactionForm.svelte';
import type { Account, Category, Transaction } from '$lib/domains/money/types/Money.types';

function acc(over: Partial<Account> & { id: number; name: string }): Account {
	return { total: '0.00', created_at: '2026-01-01T00:00:00Z', ...over };
}

function cat(over: Partial<Category> & { id: number; name: string }): Category {
	return { parent_id: null, type: 'expense', created_at: '2026-01-01T00:00:00Z', ...over };
}

function tx(over: Partial<Transaction> & { id: number }): Transaction {
	return {
		type: 'expense',
		amount: '10.00',
		account_id: 1,
		to_account_id: null,
		category_id: 5,
		description: null,
		occurred_at: '2026-03-01T12:00:00.000Z',
		created_at: '2026-03-01T12:00:00.000Z',
		...over,
	};
}

const ACCOUNTS: Account[] = [acc({ id: 1, name: 'Checking' }), acc({ id: 2, name: 'Savings' })];
const CATEGORIES: Category[] = [
	cat({ id: 5, name: 'Food', type: 'expense' }),
	cat({ id: 6, name: 'Salary', type: 'income' }),
	cat({ id: 7, name: 'Moves', type: 'transfer' }),
];

function createMockApi(): TransactionFormApi & {
	createTransaction: ReturnType<typeof vi.fn>;
	updateTransaction: ReturnType<typeof vi.fn>;
} {
	return {
		createTransaction: vi.fn().mockResolvedValue({}),
		updateTransaction: vi.fn().mockResolvedValue({}),
	};
}

describe('TransactionForm', () => {
	let TransactionForm: typeof import('$lib/domains/money/forms/transactionForm.svelte').TransactionForm;
	let api: ReturnType<typeof createMockApi>;
	let onclose: ReturnType<typeof vi.fn>;
	let refresh: ReturnType<typeof vi.fn>;

	function make(getAccounts = () => ACCOUNTS, getCategories = () => CATEGORIES) {
		return new TransactionForm(
			getAccounts,
			getCategories,
			{
				onclose: onclose as unknown as () => void,
				refresh: refresh as unknown as () => Promise<void>,
			},
			api
		);
	}

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
		TransactionForm = (await import('$lib/domains/money/forms/transactionForm.svelte'))
			.TransactionForm;
		api = createMockApi();
		onclose = vi.fn();
		refresh = vi.fn().mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	describe('validate', () => {
		it('requires amount > 0, account, and category', () => {
			const form = make();
			form.reset(null, ACCOUNTS); // accountId = first account, category null
			form.amount = '0';
			form.categoryId = null;
			form.accountId = null;

			expect(form.validate()).toBe(false);
			expect(form.amountError).toBe(true);
			expect(form.accountError).toBe(true);
			expect(form.categoryError).toBe(true);
		});

		it('passes for a valid expense', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.amount = '12.50';
			form.categoryId = 5;

			expect(form.validate()).toBe(true);
			expect(form.amountError).toBe(false);
			expect(form.accountError).toBe(false);
			expect(form.categoryError).toBe(false);
			expect(form.toAccountError).toBe(false);
		});

		it('transfer requires a distinct destination account', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.setType('transfer');
			form.amount = '5';
			form.categoryId = 7;
			form.accountId = 1;
			form.toAccountId = null;
			expect(form.validate()).toBe(false);
			expect(form.toAccountError).toBe(true);

			form.toAccountId = 1; // same as source → still invalid
			expect(form.validate()).toBe(false);
			expect(form.toAccountError).toBe(true);

			form.toAccountId = 2; // distinct → valid
			expect(form.validate()).toBe(true);
			expect(form.toAccountError).toBe(false);
		});
	});

	describe('setType + clearCategoryIfInvalid', () => {
		it('drops a category that no longer matches the type', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.categoryId = 5; // expense category
			form.setType('income');
			form.clearCategoryIfInvalid();
			expect(form.categoryId).toBeNull();
		});

		it('keeps a category still valid for the type', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.setType('income');
			form.categoryId = 6; // income category
			form.clearCategoryIfInvalid();
			expect(form.categoryId).toBe(6);
		});
	});

	describe('clearToAccountIfInvalid', () => {
		it('nulls the destination when not a transfer', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.setType('expense');
			form.toAccountId = 2;
			form.clearToAccountIfInvalid();
			expect(form.toAccountId).toBeNull();
		});

		it('nulls the destination when it equals the source account', () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.setType('transfer');
			form.accountId = 1;
			form.toAccountId = 1; // equals source → not in toAccountOptions
			form.clearToAccountIfInvalid();
			expect(form.toAccountId).toBeNull();
		});
	});

	describe('save (create)', () => {
		it('builds a create payload and closes + refreshes', async () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.amount = '12.5';
			form.accountId = 1;
			form.categoryId = 5;
			form.description = '  lunch  ';

			await form.save();

			expect(api.createTransaction).toHaveBeenCalledTimes(1);
			const payload = api.createTransaction.mock.calls[0][0];
			expect(payload).toMatchObject({
				type: 'expense',
				amount: '12.50',
				account_id: 1,
				to_account_id: null,
				category_id: 5,
				description: 'lunch',
			});
			// occurred_at is sent (seeded to now), undefined-able on create.
			expect(payload.occurred_at).toBeTruthy();
			expect(api.updateTransaction).not.toHaveBeenCalled();
			expect(onclose).toHaveBeenCalled();
			expect(refresh).toHaveBeenCalled();
		});

		it('sends to_account_id only for transfers', async () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.setType('transfer');
			form.amount = '30';
			form.accountId = 1;
			form.toAccountId = 2;
			form.categoryId = 7;

			await form.save();

			const payload = api.createTransaction.mock.calls[0][0];
			expect(payload.to_account_id).toBe(2);
		});

		it('does not call the API when invalid', async () => {
			const form = make();
			form.reset(null, ACCOUNTS);
			form.amount = '0';
			form.categoryId = null;

			await form.save();

			expect(api.createTransaction).not.toHaveBeenCalled();
			expect(onclose).not.toHaveBeenCalled();
		});
	});

	describe('save (update)', () => {
		it('builds an update payload and always sends occurred_at', async () => {
			const form = make();
			const existing = tx({ id: 99, amount: '40.00', account_id: 1, category_id: 5 });
			form.reset(existing, ACCOUNTS);
			form.amount = '41';

			await form.save();

			expect(api.updateTransaction).toHaveBeenCalledTimes(1);
			const [id, payload] = api.updateTransaction.mock.calls[0];
			expect(id).toBe(99);
			expect(payload).toMatchObject({
				type: 'expense',
				amount: '41.00',
				account_id: 1,
				to_account_id: null,
				category_id: 5,
			});
			expect(payload.occurred_at).toBeTruthy();
			expect(api.createTransaction).not.toHaveBeenCalled();
			expect(onclose).toHaveBeenCalled();
			expect(refresh).toHaveBeenCalled();
		});
	});
});
