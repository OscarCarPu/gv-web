<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatMonth } from '$lib/domains/money/utils/budgetMonth';
	import { BudgetForm } from '$lib/domains/money/forms/budgetForm.svelte';
	import type { BudgetAmount, BudgetItem, Category } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		item?: BudgetItem | null;
		month: string;
		categories: Category[];
		averages: BudgetAmount[];
	}

	let { open, onclose, item = null, month, categories, averages }: Props = $props();

	const form = new BudgetForm(
		() => categories,
		() => averages,
		{ onclose: () => onclose(), refresh: invalidateAll }
	);

	$effect(() => {
		if (open) form.reset(item, month);
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{item ? `Budget · ${item.name}` : 'New budget'}</h3>

	<div class="detail-form">
		{#if !item}
			<div class="detail-field">
				<label for="budget-category">Category</label>
				<select
					id="budget-category"
					bind:value={form.categoryId}
					class:field-error={form.categoryError}
					onchange={() => (form.categoryError = false)}
				>
					<option value={null}>Select a category</option>
					{#each form.categoryGroups as group (group.label)}
						<optgroup label={group.label}>
							{#each group.options as cat (cat.id)}
								<option value={cat.id}>{cat.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
		{/if}

		<div class="detail-field">
			<label for="budget-amount">Monthly amount</label>
			<input
				id="budget-amount"
				type="number"
				inputmode="decimal"
				step="0.01"
				min="0"
				bind:value={form.amount}
				class:field-error={form.amountError}
				oninput={() => (form.amountError = false)}
				onkeydown={(e) => e.key === 'Enter' && form.save()}
			/>
			{#if form.average !== null}
				<button class="money-budget-suggest" onclick={() => form.useAverage()}>
					3-month average: {formatMoney(form.average)}
				</button>
			{/if}
		</div>

		<div class="detail-field">
			<span class="detail-info-label">Applies to</span>
			<div class="create-mode-toggle money-budget-scope">
				<button class:active={form.scope === 'forward'} onclick={() => (form.scope = 'forward')}>
					From {formatMonth(month, true)} on
				</button>
				<button class:active={form.scope === 'month'} onclick={() => (form.scope = 'month')}>
					{formatMonth(month, true)} only
				</button>
			</div>
		</div>

		<div class="detail-actions">
			{#if item}
				<button class="btn-danger" onclick={() => form.remove()} disabled={form.saving}>
					Remove
				</button>
			{/if}
			<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
				{item ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
