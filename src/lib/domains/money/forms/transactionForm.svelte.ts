import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { toISOString, toLocalDatetime } from '$lib/shared/utils/datetime';
import { buildCategoryOptions, type CategoryOption } from '$lib/domains/money/utils/categoryTree';
import type {
	Account,
	Category,
	CreateTransactionRequest,
	Transaction,
	TransactionType,
	UpdateTransactionRequest,
} from '$lib/domains/money/types/Money.types';

export interface TransactionFormApi {
	createTransaction: (input: CreateTransactionRequest) => Promise<Transaction>;
	updateTransaction: (id: number, input: UpdateTransactionRequest) => Promise<Transaction>;
}

export interface TransactionFormCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns all of `TransactionFormSheet`'s logic: the editable `$state` form fields
 * (`bind:`-ed directly by the template), create-vs-edit seeding (`reset`), the
 * type toggle (`setType`), validation, and save (create / update per the money rules
 * then `invalidateAll`). `accounts` / `categories` are injected as getters so the
 * controller reads the sheet's live props; derived option lists are `get` accessors
 * (reactive in templates) per the "used before its initialization" lesson.
 *
 * The THREE reactive-cleanup effects (reset category when it leaves the filtered
 * options; null `toAccountId` when not a transfer; null `toAccountId` when it equals
 * the source / leaves its options) stay as `$effect`s IN THE COMPONENT — they read
 * these getters and call the matching setters (`clearCategoryIfInvalid()` /
 * `clearToAccountIfInvalid()`), so no `$effect` is buried inside the controller.
 */
export class TransactionForm {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: TransactionFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;
	#getAccounts: () => Account[];
	#getCategories: () => Category[];

	// The transaction currently being edited (null = create), set by `reset`.
	#transaction = $state<Transaction | null>(null);

	// Editable form fields (bound directly via `bind:` in the template).
	type = $state<TransactionType>('expense');
	amount = $state<string>('');
	accountId = $state<number | null>(null);
	toAccountId = $state<number | null>(null);
	categoryId = $state<number | null>(null);
	description = $state('');
	occurredAt = $state('');

	// View-only flags.
	saving = $state(false);
	amountError = $state(false);
	accountError = $state(false);
	categoryError = $state(false);
	toAccountError = $state(false);

	constructor(
		getAccounts: () => Account[],
		getCategories: () => Category[],
		{ onclose, refresh }: TransactionFormCallbacks,
		api: TransactionFormApi = moneyApi
	) {
		this.#getAccounts = getAccounts;
		this.#getCategories = getCategories;
		this.#onclose = onclose;
		this.#refresh = refresh;
		this.#api = api;
	}

	get transaction(): Transaction | null {
		return this.#transaction;
	}

	// ── derived option lists (getters: reactive when read in templates / effects) ──

	get categoryOptions(): CategoryOption[] {
		return buildCategoryOptions(this.#getCategories().filter((c) => c.type === this.type));
	}

	get toAccountOptions(): Account[] {
		return this.#getAccounts().filter((a) => a.id !== this.accountId);
	}

	// ── seeding (mirrors the component's previous open $effect) ──────────────

	/**
	 * Seed the form for create or edit. Passing a `transaction` hydrates it for editing;
	 * passing `null` resets to a fresh "new transaction" (type=expense, first account,
	 * now). Always clears the error flags.
	 */
	reset(transaction: Transaction | null, accounts: Account[]): void {
		this.#transaction = transaction;
		if (transaction) {
			this.type = transaction.type;
			this.amount = transaction.amount;
			this.accountId = transaction.account_id;
			this.toAccountId = transaction.to_account_id;
			this.categoryId = transaction.category_id;
			this.description = transaction.description ?? '';
			this.occurredAt = toLocalDatetime(transaction.occurred_at);
		} else {
			this.type = 'expense';
			this.amount = '';
			this.accountId = accounts[0]?.id ?? null;
			this.toAccountId = null;
			this.categoryId = null;
			this.description = '';
			this.occurredAt = toLocalDatetime(new Date().toISOString());
		}
		this.amountError = false;
		this.accountError = false;
		this.categoryError = false;
		this.toAccountError = false;
	}

	setType(next: TransactionType): void {
		this.type = next;
	}

	// ── reactive-cleanup setters (driven by component $effects) ──────────────

	/** Reset `categoryId` when it is no longer in the type-filtered options. */
	clearCategoryIfInvalid(): void {
		if (this.categoryId !== null && !this.categoryOptions.some((c) => c.id === this.categoryId)) {
			this.categoryId = null;
		}
	}

	/**
	 * Null `toAccountId` when the type is not a transfer, or when it equals the source
	 * account / is no longer a valid destination option. Mirrors the component's two
	 * `toAccountId` cleanup `$effect`s combined.
	 */
	clearToAccountIfInvalid(): void {
		if (this.type !== 'transfer') {
			this.toAccountId = null;
			return;
		}
		if (
			this.toAccountId !== null &&
			!this.toAccountOptions.some((a) => a.id === this.toAccountId)
		) {
			this.toAccountId = null;
		}
	}

	// ── validate / save ──────────────────────────────────────────────────────

	/** Set the four error flags; return true when the form is valid. */
	validate(): boolean {
		const amt = parseFloat(this.amount);
		this.amountError = !(amt > 0);
		this.accountError = this.accountId === null;
		this.categoryError = this.categoryId === null;
		this.toAccountError =
			this.type === 'transfer' &&
			(this.toAccountId === null || this.toAccountId === this.accountId);
		return !(this.amountError || this.accountError || this.categoryError || this.toAccountError);
	}

	async save(): Promise<void> {
		if (!this.validate()) return;

		const amt = parseFloat(this.amount);
		this.saving = true;
		try {
			const occurredISO = toISOString(this.occurredAt);
			const transaction = this.#transaction;
			if (transaction) {
				if (!occurredISO) {
					addToast('Date is required', 'error');
					this.saving = false;
					return;
				}
				await this.#api.updateTransaction(transaction.id, {
					type: this.type,
					amount: amt.toFixed(2),
					account_id: this.accountId!,
					to_account_id: this.type === 'transfer' ? this.toAccountId : null,
					category_id: this.categoryId!,
					description: this.description.trim() || null,
					occurred_at: occurredISO,
				});
				addNotification('Transaction updated', 'success');
			} else {
				await this.#api.createTransaction({
					type: this.type,
					amount: amt.toFixed(2),
					account_id: this.accountId!,
					to_account_id: this.type === 'transfer' ? this.toAccountId : null,
					category_id: this.categoryId!,
					description: this.description.trim() || null,
					occurred_at: occurredISO ?? undefined,
				});
				addNotification('Transaction created', 'success');
			}
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error saving transaction', 'error');
		} finally {
			this.saving = false;
		}
	}
}
