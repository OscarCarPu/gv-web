<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import {
		getTypeBadgeClass,
		getTypeLabel,
		amountClass as amountClassFor,
		amountPrefix,
	} from '../utils/transactionType';
	import type { OverviewTransaction } from '$lib/domains/money/types/Money.types';

	interface Props {
		tx: OverviewTransaction;
		/** Omit both for a read-only row (e.g. a budget's transactions). */
		onedit?: (id: number) => void;
		ondelete?: (id: number) => void;
	}

	let { tx, onedit, ondelete }: Props = $props();

	let amountClass = $derived(amountClassFor(tx.type));
	let prefix = $derived(amountPrefix(tx.type));
	let name = $derived(tx.description?.trim() || tx.category_name || '—');
</script>

<div class="task-item money-tx-row">
	<div class="money-tx-info">
		<span class="status-badge {getTypeBadgeClass(tx.type)}">{getTypeLabel(tx.type)}</span>
		{#if onedit}
			<button class="task-name-btn money-tx-text" onclick={() => onedit(tx.id)}>
				<span class="money-tx-name">{name}</span>
				<span class="money-tx-account">
					· {tx.account_name}{#if tx.to_account_name}&nbsp;→ {tx.to_account_name}{/if}
				</span>
			</button>
		{:else}
			<span class="money-tx-text">
				<span class="money-tx-name">{name}</span>
				<span class="money-tx-account">
					· {tx.category_name ?? tx.account_name}
				</span>
			</span>
		{/if}
	</div>
	<div class="task-actions">
		<span class={amountClass}>{prefix}{formatMoney(tx.amount)}</span>
		{#if ondelete}
			<button class="btn-icon" title="Delete" onclick={() => ondelete(tx.id)}>
				<Icon name="trash" />
			</button>
		{/if}
	</div>
</div>
