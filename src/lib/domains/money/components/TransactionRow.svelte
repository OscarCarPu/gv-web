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
	let name = $derived(tx.description?.trim() || tx.category_name || '—');
</script>

<div class="task-item money-tx-row">
	<div class="money-tx-info">
		<span class="status-badge {getTypeBadgeClass(tx.type)}">{getTypeLabel(tx.type)}</span>
		<button class="task-name-btn money-tx-text" onclick={() => onedit(tx.id)}>
			<span class="money-tx-name">{name}</span>
			<span class="money-tx-account">
				· {tx.account_name}{#if tx.to_account_name}&nbsp;→ {tx.to_account_name}{/if}
			</span>
		</button>
	</div>
	<div class="task-actions">
		<span class={amountClass}>{prefix}{formatMoney(tx.amount)}</span>
		<button class="btn-icon" title="Delete" onclick={() => ondelete(tx.id)}>
			<Icon name="trash" />
		</button>
	</div>
</div>
