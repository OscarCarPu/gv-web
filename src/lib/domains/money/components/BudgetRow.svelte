<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatMonth } from '$lib/domains/money/utils/budgetMonth';
	import type { BudgetItem } from '$lib/domains/money/types/Money.types';

	interface Props {
		item: BudgetItem;
		/** Elapsed share of the budget's period, or null outside the current one. */
		pace: number | null;
		expanded: boolean;
		/** Click on the row: show / hide the transactions the budget counted. */
		ontoggle: (item: BudgetItem) => void;
		onedit: (item: BudgetItem) => void;
	}

	let { item, pace, expanded, ontoggle, onedit }: Props = $props();

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

	function onkeydown(e: KeyboardEvent) {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ontoggle(item);
		}
	}
</script>

<div
	class="task-item money-budget-row {item.status}"
	class:expanded
	style:--budget-depth={item.depth}
	role="button"
	tabindex="0"
	aria-expanded={expanded}
	onclick={() => ontoggle(item)}
	{onkeydown}
>
	<div class="money-budget-head">
		<span class="money-budget-chevron"><Icon name="chevron-right" /></span>
		<span class="money-budget-name">{item.name}</span>
		<span class="money-budget-amounts">
			<span class="amount-neutral">{formatMoney(item.actual)}</span>
			<span class="money-budget-of">/ {formatMoney(item.budget)}</span>
		</span>
		<span class="money-budget-pct">{item.status === 'met' ? '✓' : `${percent}%`}</span>
		<button
			class="btn-icon money-budget-edit"
			title="Edit budget"
			aria-label="Edit budget"
			onclick={(e) => {
				e.stopPropagation();
				onedit(item);
			}}
		>
			<Icon name="pen" />
		</button>
	</div>
	<div class="money-budget-bar">
		<div class="progress-track">
			<div class="progress-fill" style:width="{fill}%"></div>
		</div>
		{#if pace !== null}
			<span class="money-budget-pace" style:left="{pace * 100}%" title="Elapsed"></span>
		{/if}
	</div>
	<div class="money-budget-meta">
		<span class:amount-negative={item.status === 'over'}>{note}</span>
		<span>since {item.period === 'yearly' ? item.since : formatMonth(item.since, true)}</span>
	</div>
</div>
