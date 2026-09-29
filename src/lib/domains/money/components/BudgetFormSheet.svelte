<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatMonth } from '$lib/domains/money/utils/budgetMonth';
	import { BudgetForm } from '$lib/domains/money/forms/budgetForm.svelte';
	import type { BudgetMonth, BudgetItem, Category } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		item?: BudgetItem | null;
		categories: Category[];
		/** The loaded month: its `month`, and its averages / previous-year totals for suggestions. */
		budgets: BudgetMonth;
	}

	let { open, onclose, item = null, categories, budgets }: Props = $props();

	const form = new BudgetForm(
		() => categories,
		() => budgets,
		{ onclose: () => onclose(), refresh: invalidateAll }
	);

	let yearly = $derived(form.period === 'yearly');
	let periodLabel = $derived(yearly ? form.month.slice(0, 4) : formatMonth(form.month, true));

	$effect(() => {
		if (open) form.reset(item, budgets.month);
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{item ? `Budget · ${item.name}` : 'New budget'}</h3>

	{#if !item}
		<div class="create-mode-toggle money-budget-period">
			<button class:active={!yearly} onclick={() => (form.period = 'monthly')}>Monthly</button>
			<button class:active={yearly} onclick={() => (form.period = 'yearly')}>Yearly</button>
		</div>
	{/if}

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
			<label for="budget-amount">{yearly ? 'Yearly amount' : 'Monthly amount'}</label>
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
			{#if form.suggestion !== null}
				<button class="money-budget-suggest" onclick={() => form.useSuggestion()}>
					{yearly ? 'Last year' : '3-month average'}: {formatMoney(form.suggestion)}
				</button>
			{/if}
		</div>

		<div class="detail-field">
			<span class="detail-info-label">Applies to</span>
			<div class="create-mode-toggle money-budget-scope">
				<button class:active={form.scope === 'forward'} onclick={() => (form.scope = 'forward')}>
					From {periodLabel} on
				</button>
				<button class:active={form.scope === 'once'} onclick={() => (form.scope = 'once')}>
					{periodLabel} only
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
