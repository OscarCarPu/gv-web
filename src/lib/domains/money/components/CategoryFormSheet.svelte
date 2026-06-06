<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { CategoryForm } from '$lib/domains/money/forms/categoryForm.svelte';
	import type { Category } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		category?: Category | null;
		categories: Category[];
	}

	let { open, onclose, category = null, categories }: Props = $props();

	const form = new CategoryForm(() => categories, {
		onclose: () => onclose(),
		refresh: invalidateAll,
	});

	$effect(() => {
		if (open) form.reset(category);
	});

	$effect(() => {
		form.clearParentIfInvalid();
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{category ? 'Edit category' : 'New category'}</h3>

	<div class="create-mode-toggle money-type-toggle">
		<button
			class="income"
			class:active={form.type === 'income'}
			onclick={() => (form.type = 'income')}>Income</button
		>
		<button
			class="expense"
			class:active={form.type === 'expense'}
			onclick={() => (form.type = 'expense')}>Expense</button
		>
		<button
			class="transfer"
			class:active={form.type === 'transfer'}
			onclick={() => (form.type = 'transfer')}>Transfer</button
		>
	</div>

	<div class="detail-form">
		<div class="detail-field">
			<label for="category-name">Name</label>
			<input
				id="category-name"
				type="text"
				bind:value={form.name}
				maxlength={40}
				class:field-error={form.nameError}
				oninput={() => (form.nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && form.save()}
			/>
		</div>

		<div class="detail-field">
			<label for="category-parent">Parent category</label>
			<select id="category-parent" bind:value={form.parentId}>
				<option value={null}>No parent</option>
				{#each form.parentOptions as parent (parent.id)}
					<option value={parent.id}>{parent.label}</option>
				{/each}
			</select>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
				{category ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
