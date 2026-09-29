<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { currentMonth } from '$lib/domains/money/utils/budgetMonth';
	import { MoneyBudgets } from '$lib/domains/money/budgets.svelte';
	import BudgetRow from './BudgetRow.svelte';
	import BudgetFormSheet from './BudgetFormSheet.svelte';
	import type { BudgetMonth, Category } from '$lib/domains/money/types/Money.types';

	interface Props {
		budgets: BudgetMonth;
		categories: Category[];
	}

	let { budgets, categories }: Props = $props();

	const controller = new MoneyBudgets(() => budgets);

	function goMonth(month: string) {
		goto(`${resolve('/money/budgets')}?month=${month}`, { noScroll: true, keepFocus: true });
	}

	const openEdit = (item: Parameters<typeof controller.openEdit>[0]) => controller.openEdit(item);
</script>

<div class="date-navigation money-month-nav">
	<button
		title="Go to this month"
		class:invisible={controller.isCurrent}
		onclick={() => goMonth(currentMonth())}
	>
		<Icon name="calendar-day" />
	</button>
	<button title="Previous month" onclick={() => goMonth(controller.prevMonth)}>
		<Icon name="arrow-left" />
	</button>
	<p>{controller.label}</p>
	<button title="Next month" onclick={() => goMonth(controller.nextMonth)}>
		<Icon name="arrow-right" />
	</button>
</div>

<section class="tasks-section money-budgets">
	<div class="section-header">
		<h2>Budgets</h2>
		<button class="btn-primary btn-sm" onclick={() => controller.openCreate()}>
			<Icon name="plus" /> Budget
		</button>
	</div>

	<div class="money-tiles money-tiles-wrap money-budget-tiles">
		<div class="money-tile">
			<span class="detail-info-label">Spent</span>
			<span class="detail-info-value amount-negative">{formatMoney(budgets.expense.actual)}</span>
			<span class="money-tile-sub">of {formatMoney(budgets.expense.budgeted)}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Earned</span>
			<span class="detail-info-value amount-positive">{formatMoney(budgets.income.actual)}</span>
			<span class="money-tile-sub">of {formatMoney(budgets.income.budgeted)}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Balance</span>
			<span
				class="detail-info-value"
				class:amount-positive={controller.balance > 0}
				class:amount-negative={controller.balance < 0}
			>
				{controller.balanceLabel}
			</span>
			<span class="money-tile-sub">of {controller.forecastLabel} planned</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Off budget</span>
			<span
				class="detail-info-value"
				class:amount-negative={controller.offBudget > 0}
				class:amount-neutral={controller.offBudget <= 0}
			>
				{formatMoney(controller.offBudget.toFixed(2))}
			</span>
			<span class="money-tile-sub">
				{formatMoney(budgets.expense.unbudgeted)} outside budgets
			</span>
			<span class="money-tile-sub">{formatMoney(budgets.expense.overspent)} overspent</span>
		</div>
	</div>

	{#if controller.isEmpty}
		<div class="project-children-empty">No budgets for this month</div>
	{:else}
		{#each controller.groups as group (group.type)}
			{#if group.items.length > 0}
				<h3 class="money-group-label">{group.label}</h3>
				<div class="task-list">
					{#each group.items as item (item.category_id)}
						<BudgetRow {item} pace={controller.pace} onedit={openEdit} />
					{/each}
				</div>
			{/if}
		{/each}
	{/if}
</section>

<BudgetFormSheet
	open={controller.sheetOpen}
	onclose={() => controller.closeSheet()}
	item={controller.editing}
	month={budgets.month}
	{categories}
	averages={budgets.averages}
/>
