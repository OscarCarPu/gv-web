import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import type {
	Account,
	CreateAccountRequest,
	UpdateAccountRequest,
} from '$lib/domains/money/types/Money.types';

interface AccountFormApi {
	createAccount: (input: CreateAccountRequest) => Promise<Account>;
	updateAccount: (id: number, input: UpdateAccountRequest) => Promise<Account>;
}

interface AccountFormCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns `AccountFormSheet`'s logic: the editable `name` field, create-vs-edit seeding
 * (`reset`), name validation, and save (create / update then `invalidateAll`).
 */
export class AccountForm {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: AccountFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;

	// The account currently being edited (null = create), set by `reset`.
	#account = $state<Account | null>(null);

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');

	// View-only flags.
	saving = $state(false);
	nameError = $state(false);

	constructor({ onclose, refresh }: AccountFormCallbacks, api: AccountFormApi = moneyApi) {
		this.#onclose = onclose;
		this.#refresh = refresh;
		this.#api = api;
	}

	get account(): Account | null {
		return this.#account;
	}

	reset(account: Account | null): void {
		this.#account = account;
		this.name = account?.name ?? '';
		this.nameError = false;
	}

	async save(): Promise<void> {
		if (!this.name.trim()) {
			this.nameError = true;
			return;
		}
		this.saving = true;
		try {
			const account = this.#account;
			if (account) {
				await this.#api.updateAccount(account.id, { name: this.name.trim() });
				addNotification('Account updated', 'success');
			} else {
				await this.#api.createAccount({ name: this.name.trim() });
				addNotification('Account created', 'success');
			}
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error saving account', 'error');
		} finally {
			this.saving = false;
		}
	}
}
