<script lang="ts">
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatMonth } from '$lib/domains/money/utils/budgetMonth';
	import type { BudgetItem } from '$lib/domains/money/types/Money.types';

	interface Props {
		item: BudgetItem;
		/** Elapsed share of the month, or null outside the current month. */
		pace: number | null;
		onedit: (item: BudgetItem) => void;
	}

	let { item, pace, onedit }: Props = $props();

	let remaining = $derived(parseFloat(item.remaining));
	let fill = $derived(Math.min(item.progress, 1) * 100);
	let percent = $derived(Math.round(item.progress * 100));
	let note = $derived(
		item.type === 'income'
			? remaining > 0
				? `${formatMoney(remaining.toFixed(2))} to go`
				: `${formatMoney(Math.abs(remaining).toFixed(2))} above`
			: remaining >= 0
				? `${formatMoney(remaining.toFixed(2))} left`
				: `${formatMoney(Math.abs(remaining).toFixed(2))} over`
	);
</script>

<button
	class="task-item money-budget-row {item.status}"
	style:--budget-depth={item.depth}
	onclick={() => onedit(item)}
>
	<div class="money-budget-head">
		<span class="money-budget-name">{item.name}</span>
		<span class="money-budget-amounts">
			<span class="amount-neutral">{formatMoney(item.actual)}</span>
			<span class="money-budget-of">/ {formatMoney(item.budget)}</span>
		</span>
		<span class="money-budget-pct">{item.status === 'met' ? '✓' : `${percent}%`}</span>
	</div>
	<div class="money-budget-bar">
		<div class="progress-track">
			<div class="progress-fill" style:width="{fill}%"></div>
		</div>
		{#if pace !== null}
			<span class="money-budget-pace" style:left="{pace * 100}%" title="Month elapsed"></span>
		{/if}
	</div>
	<div class="money-budget-meta">
		<span class:amount-negative={item.status === 'over'}>{note}</span>
		<span>since {formatMonth(item.since, true)}</span>
	</div>
</button>
