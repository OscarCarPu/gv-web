<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import type { Account } from '$lib/domains/money/types/Money.types';

	interface Props {
		account: Account;
		onedit: (account: Account) => void;
		ondelete: (account: Account) => void;
	}

	let { account, onedit, ondelete }: Props = $props();
</script>

<div class="task-item">
	<div class="task-info">
		<div class="task-name-row">
			<button class="task-name-btn" onclick={() => onedit(account)}>{account.name}</button>
		</div>
	</div>
	<div class="task-actions">
		<span class="amount-neutral">{formatMoney(account.total)}</span>
		<button class="btn-icon" title="Edit" onclick={() => onedit(account)}>
			<Icon name="pen" />
		</button>
		<button class="btn-icon" title="Delete" onclick={() => ondelete(account)}>
			<Icon name="trash" />
		</button>
	</div>
</div>
