<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import type { Account } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		account?: Account | null;
	}

	let { open, onclose, account = null }: Props = $props();

	let name = $state('');
	let saving = $state(false);
	let nameError = $state(false);

	$effect(() => {
		if (open) {
			name = account?.name ?? '';
			nameError = false;
		}
	});

	async function save() {
		if (!name.trim()) {
			nameError = true;
			return;
		}
		saving = true;
		try {
			if (account) {
				await moneyApi.updateAccount(account.id, { name: name.trim() });
				addNotification('Account updated', 'success');
			} else {
				await moneyApi.createAccount({ name: name.trim() });
				addNotification('Account created', 'success');
			}
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error saving account', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{account ? 'Edit account' : 'New account'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="account-name">Name</label>
			<input
				id="account-name"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && save()}
			/>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={save} disabled={saving}>
				{account ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
