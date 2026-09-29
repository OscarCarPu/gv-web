<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatDueDay } from '$lib/shared/utils/datetime';
	import TransactionRow from './TransactionRow.svelte';
	import type { OverviewTransaction } from '$lib/domains/money/types/Money.types';

	interface Props {
		transactions: OverviewTransaction[];
		loading: boolean;
		/** Same indent as the row it belongs to. */
		depth: number;
		remaining: number;
		onshowmore: () => void;
	}

	let { transactions, loading, depth, remaining, onshowmore }: Props = $props();
</script>

<div class="money-budget-txs" style:--budget-depth={depth}>
	{#if loading && transactions.length === 0}
		<div class="project-children-empty">Loading…</div>
	{:else if transactions.length === 0}
		<div class="project-children-empty">No transactions</div>
	{:else}
		<div class="task-list">
			{#each transactions as tx, i (tx.id)}
				{@const day = tx.occurred_at.slice(0, 10)}
				{#if i === 0 || day !== transactions[i - 1].occurred_at.slice(0, 10)}
					<div class="agenda-day-divider">
						<span class="agenda-day-line"></span>
						<span class="agenda-day-label">{formatDueDay(tx.occurred_at)}</span>
						<span class="agenda-day-line"></span>
					</div>
				{/if}
				<TransactionRow {tx} />
			{/each}
		</div>
		{#if remaining > 0}
			<button class="show-more-btn" onclick={onshowmore}>
				<span class="show-more-line"></span>
				<span class="show-more-pill">
					<Icon name="chevron-down" />
					<span>{remaining} more</span>
				</span>
				<span class="show-more-line"></span>
			</button>
		{/if}
	{/if}
</div>
