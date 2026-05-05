<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import AccountRow from './AccountRow.svelte';
	import AccountFormSheet from './AccountFormSheet.svelte';
	import type { Account } from '$lib/domains/money/types/Money.types';

	interface Props {
		accounts: Account[];
	}

	let { accounts }: Props = $props();

	let sheetOpen = $state(false);
	let editing = $state<Account | null>(null);

	function openCreate() {
		editing = null;
		sheetOpen = true;
	}

	function openEdit(account: Account) {
		editing = account;
		sheetOpen = true;
	}

	async function onDelete(account: Account) {
		try {
			await moneyApi.deleteAccount(account.id);
			addNotification('Cuenta eliminada', 'success');
			await invalidateAll();
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (msg.includes('transactions')) {
				addToast('La cuenta tiene movimientos asociados', 'error');
			} else {
				addToast('Error al eliminar la cuenta', 'error');
			}
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Cuentas</h2>
		<button class="btn-action-sm" onclick={openCreate}>
			<Icon name="plus" /> Nueva
		</button>
	</div>

	{#if accounts.length === 0}
		<div class="project-children-empty">Sin cuentas</div>
	{:else}
		<div class="task-list">
			{#each accounts as account (account.id)}
				<AccountRow {account} onedit={openEdit} ondelete={onDelete} />
			{/each}
		</div>
	{/if}
</section>

<AccountFormSheet open={sheetOpen} onclose={() => (sheetOpen = false)} account={editing} />
