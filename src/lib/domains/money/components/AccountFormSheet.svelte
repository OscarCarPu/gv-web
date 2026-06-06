<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { AccountForm } from '$lib/domains/money/forms/accountForm.svelte';
	import type { Account } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		account?: Account | null;
	}

	let { open, onclose, account = null }: Props = $props();

	const form = new AccountForm({ onclose: () => onclose(), refresh: invalidateAll });

	$effect(() => {
		if (open) form.reset(account);
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{account ? 'Edit account' : 'New account'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="account-name">Name</label>
			<input
				id="account-name"
				type="text"
				bind:value={form.name}
				maxlength={40}
				class:field-error={form.nameError}
				oninput={() => (form.nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && form.save()}
			/>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
				{account ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
