<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { getTypeBadgeClass, getTypeLabel, amountSign } from '../utils/transactionType';
	import type { OverviewTransaction } from '$lib/domains/money/types/Money.types';

	interface Props {
		tx: OverviewTransaction;
		onedit: (id: number) => void;
		ondelete: (id: number) => void;
	}

	let { tx, onedit, ondelete }: Props = $props();

	let sign = $derived(amountSign(tx.type));
	let amountClass = $derived(
		sign === 'pos' ? 'amount-positive' : sign === 'neg' ? 'amount-negative' : 'amount-neutral'
	);
	let prefix = $derived(sign === 'pos' ? '+' : sign === 'neg' ? '−' : '');
</script>

<div class="task-item money-tx-row">
	<div class="money-tx-info">
		<span class="status-badge {getTypeBadgeClass(tx.type)}">{getTypeLabel(tx.type)}</span>
		<button class="task-name-btn money-tx-account" onclick={() => onedit(tx.id)}>
			{tx.account_name}{#if tx.to_account_name}
				&nbsp;→ {tx.to_account_name}
			{/if}
		</button>
		<span class="money-tx-category">
			· {#if tx.category_name}{tx.category_name}{:else}—{/if}
		</span>
	</div>
	<div class="task-actions">
		<span class={amountClass}>{prefix}{formatMoney(tx.amount)}</span>
		<button class="btn-icon" title="Eliminar" onclick={() => ondelete(tx.id)}>
			<Icon name="trash" />
		</button>
	</div>
</div>
