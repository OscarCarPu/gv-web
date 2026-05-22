<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { toISOString, toLocalDatetime } from '$lib/shared/utils/datetime';
	import { buildCategoryOptions } from '$lib/domains/money/utils/categoryTree';
	import type {
		Account,
		Category,
		Transaction,
		TransactionType,
	} from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		transaction?: Transaction | null;
		accounts: Account[];
		categories: Category[];
	}

	let { open, onclose, transaction = null, accounts, categories }: Props = $props();

	let type = $state<TransactionType>('expense');
	let amount = $state<string>('');
	let accountId = $state<number | null>(null);
	let toAccountId = $state<number | null>(null);
	let categoryId = $state<number | null>(null);
	let description = $state('');
	let occurredAt = $state('');
	let saving = $state(false);
	let amountError = $state(false);
	let accountError = $state(false);
	let categoryError = $state(false);
	let toAccountError = $state(false);

	$effect(() => {
		if (open) {
			if (transaction) {
				type = transaction.type;
				amount = transaction.amount;
				accountId = transaction.account_id;
				toAccountId = transaction.to_account_id;
				categoryId = transaction.category_id;
				description = transaction.description ?? '';
				occurredAt = toLocalDatetime(transaction.occurred_at);
			} else {
				type = 'expense';
				amount = '';
				accountId = accounts[0]?.id ?? null;
				toAccountId = null;
				categoryId = null;
				description = '';
				occurredAt = toLocalDatetime(new Date().toISOString());
			}
			amountError = false;
			accountError = false;
			categoryError = false;
			toAccountError = false;
		}
	});

	let categoryOptions = $derived(buildCategoryOptions(categories.filter((c) => c.type === type)));

	$effect(() => {
		if (categoryId !== null && !categoryOptions.some((c) => c.id === categoryId)) {
			categoryId = null;
		}
	});

	$effect(() => {
		if (type !== 'transfer') {
			toAccountId = null;
		}
	});

	let toAccountOptions = $derived(accounts.filter((a) => a.id !== accountId));

	$effect(() => {
		if (toAccountId !== null && !toAccountOptions.some((a) => a.id === toAccountId)) {
			toAccountId = null;
		}
	});

	function setType(next: TransactionType) {
		type = next;
	}

	async function save() {
		const amt = parseFloat(amount);
		amountError = !(amt > 0);
		accountError = accountId === null;
		categoryError = categoryId === null;
		toAccountError = type === 'transfer' && (toAccountId === null || toAccountId === accountId);
		if (amountError || accountError || categoryError || toAccountError) return;

		saving = true;
		try {
			const occurredISO = toISOString(occurredAt);
			if (transaction) {
				if (!occurredISO) {
					addToast('Date is required', 'error');
					saving = false;
					return;
				}
				await moneyApi.updateTransaction(transaction.id, {
					type,
					amount: amt.toFixed(2),
					account_id: accountId!,
					to_account_id: type === 'transfer' ? toAccountId : null,
					category_id: categoryId!,
					description: description.trim() || null,
					occurred_at: occurredISO,
				});
				addNotification('Transaction updated', 'success');
			} else {
				await moneyApi.createTransaction({
					type,
					amount: amt.toFixed(2),
					account_id: accountId!,
					to_account_id: type === 'transfer' ? toAccountId : null,
					category_id: categoryId!,
					description: description.trim() || null,
					occurred_at: occurredISO ?? undefined,
				});
				addNotification('Transaction created', 'success');
			}
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error saving transaction', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{transaction ? 'Edit transaction' : 'New transaction'}</h3>

	<div class="create-mode-toggle money-type-toggle">
		<button class="income" class:active={type === 'income'} onclick={() => setType('income')}
			>Income</button
		>
		<button class="expense" class:active={type === 'expense'} onclick={() => setType('expense')}
			>Expense</button
		>
		<button class="transfer" class:active={type === 'transfer'} onclick={() => setType('transfer')}
			>Transfer</button
		>
	</div>

	<div class="detail-form">
		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="tx-amount">Amount</label>
				<input
					id="tx-amount"
					type="number"
					inputmode="decimal"
					step="0.01"
					min="0.01"
					bind:value={amount}
					class:field-error={amountError}
					oninput={() => (amountError = false)}
				/>
			</div>
			<div class="detail-field flex-1">
				<label for="dtp-tx-occurred">Date</label>
				<DatetimePicker bind:value={occurredAt} id="tx-occurred" />
			</div>
		</div>

		<div class="detail-field">
			<label for="tx-account">{type === 'transfer' ? 'Source account' : 'Account'}</label>
			<select
				id="tx-account"
				bind:value={accountId}
				class:field-error={accountError}
				onchange={() => (accountError = false)}
			>
				<option value={null}>Select an account</option>
				{#each accounts as account (account.id)}
					<option value={account.id}>{account.name}</option>
				{/each}
			</select>
		</div>

		{#if type === 'transfer'}
			<div class="detail-field">
				<label for="tx-to-account">Destination account</label>
				<select
					id="tx-to-account"
					bind:value={toAccountId}
					class:field-error={toAccountError}
					onchange={() => (toAccountError = false)}
				>
					<option value={null}>Select a destination account</option>
					{#each toAccountOptions as account (account.id)}
						<option value={account.id}>{account.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="detail-field">
			<label for="tx-category">Category</label>
			<select
				id="tx-category"
				bind:value={categoryId}
				class:field-error={categoryError}
				onchange={() => (categoryError = false)}
			>
				<option value={null}>Select a category</option>
				{#each categoryOptions as cat (cat.id)}
					<option value={cat.id}>{cat.label}</option>
				{/each}
			</select>
		</div>

		<div class="detail-field">
			<label for="tx-desc">Description</label>
			<textarea id="tx-desc" bind:value={description} rows="2"></textarea>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={save} disabled={saving}>
				{transaction ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
