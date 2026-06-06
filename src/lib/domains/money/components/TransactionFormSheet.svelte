<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { TransactionForm } from '$lib/domains/money/forms/transactionForm.svelte';
	import type { Account, Category, Transaction } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		transaction?: Transaction | null;
		accounts: Account[];
		categories: Category[];
	}

	let { open, onclose, transaction = null, accounts, categories }: Props = $props();

	const form = new TransactionForm(
		() => accounts,
		() => categories,
		{ onclose: () => onclose(), refresh: invalidateAll }
	);

	$effect(() => {
		if (open) form.reset(transaction, accounts);
	});

	// The three reactive-cleanup effects stay in the component (no $effect inside the
	// controller): they read the controller's derived getters and call its setters.
	$effect(() => {
		form.clearCategoryIfInvalid();
	});

	$effect(() => {
		form.clearToAccountIfInvalid();
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{transaction ? 'Edit transaction' : 'New transaction'}</h3>

	<div class="create-mode-toggle money-type-toggle">
		<button
			class="income"
			class:active={form.type === 'income'}
			onclick={() => form.setType('income')}>Income</button
		>
		<button
			class="expense"
			class:active={form.type === 'expense'}
			onclick={() => form.setType('expense')}>Expense</button
		>
		<button
			class="transfer"
			class:active={form.type === 'transfer'}
			onclick={() => form.setType('transfer')}>Transfer</button
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
					bind:value={form.amount}
					class:field-error={form.amountError}
					oninput={() => (form.amountError = false)}
				/>
			</div>
			<div class="detail-field flex-1">
				<label for="dtp-tx-occurred">Date</label>
				<DatetimePicker bind:value={form.occurredAt} id="tx-occurred" />
			</div>
		</div>

		<div class="detail-field">
			<label for="tx-account">{form.type === 'transfer' ? 'Source account' : 'Account'}</label>
			<select
				id="tx-account"
				bind:value={form.accountId}
				class:field-error={form.accountError}
				onchange={() => (form.accountError = false)}
			>
				<option value={null}>Select an account</option>
				{#each accounts as account (account.id)}
					<option value={account.id}>{account.name}</option>
				{/each}
			</select>
		</div>

		{#if form.type === 'transfer'}
			<div class="detail-field">
				<label for="tx-to-account">Destination account</label>
				<select
					id="tx-to-account"
					bind:value={form.toAccountId}
					class:field-error={form.toAccountError}
					onchange={() => (form.toAccountError = false)}
				>
					<option value={null}>Select a destination account</option>
					{#each form.toAccountOptions as account (account.id)}
						<option value={account.id}>{account.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="detail-field">
			<label for="tx-category">Category</label>
			<select
				id="tx-category"
				bind:value={form.categoryId}
				class:field-error={form.categoryError}
				onchange={() => (form.categoryError = false)}
			>
				<option value={null}>Select a category</option>
				{#each form.categoryOptions as cat (cat.id)}
					<option value={cat.id}>{cat.label}</option>
				{/each}
			</select>
		</div>

		<div class="detail-field">
			<label for="tx-desc">Description</label>
			<textarea id="tx-desc" bind:value={form.description} rows="2"></textarea>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
				{transaction ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
