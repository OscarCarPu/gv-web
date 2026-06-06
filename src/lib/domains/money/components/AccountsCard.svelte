<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { deleteWithConflict } from '$lib/domains/money/utils/deleteConflict';
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
		const { ok, conflict } = await deleteWithConflict({
			run: () => moneyApi.deleteAccount(account.id),
			needles: ['transactions'],
		});
		if (ok) {
			addNotification('Account deleted', 'success');
			await invalidateAll();
		} else if (conflict) {
			addToast('Account has associated transactions', 'error');
		} else {
			addToast('Error deleting account', 'error');
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Accounts</h2>
		<button class="btn-action-sm" onclick={openCreate}>
			<Icon name="plus" /> New
		</button>
	</div>

	{#if accounts.length === 0}
		<div class="project-children-empty">No accounts</div>
	{:else}
		<div class="task-list">
			{#each accounts as account (account.id)}
				<AccountRow {account} onedit={openEdit} ondelete={onDelete} />
			{/each}
		</div>
	{/if}
</section>

<AccountFormSheet open={sheetOpen} onclose={() => (sheetOpen = false)} account={editing} />
