<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { buildCategoryOptions } from '$lib/domains/money/utils/categoryTree';
	import type { Category, TransactionType } from '$lib/domains/money/types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		category?: Category | null;
		categories: Category[];
	}

	let { open, onclose, category = null, categories }: Props = $props();

	let name = $state('');
	let type = $state<TransactionType>('expense');
	let parentId = $state<number | null>(null);
	let saving = $state(false);
	let nameError = $state(false);

	$effect(() => {
		if (open) {
			name = category?.name ?? '';
			type = category?.type ?? 'expense';
			parentId = category?.parent_id ?? null;
			nameError = false;
		}
	});

	let parentOptions = $derived.by(() => {
		const sameType = categories.filter((c) => c.type === type);
		if (!category) return buildCategoryOptions(sameType);
		const banned = new Set<number>([category.id]);
		let added = true;
		while (added) {
			added = false;
			for (const c of sameType) {
				if (c.parent_id != null && banned.has(c.parent_id) && !banned.has(c.id)) {
					banned.add(c.id);
					added = true;
				}
			}
		}
		return buildCategoryOptions(sameType.filter((c) => !banned.has(c.id)));
	});

	$effect(() => {
		if (parentId !== null && !parentOptions.some((c) => c.id === parentId)) {
			parentId = null;
		}
	});

	async function save() {
		if (!name.trim()) {
			nameError = true;
			return;
		}
		saving = true;
		try {
			if (category) {
				await moneyApi.updateCategory(category.id, {
					name: name.trim(),
					type,
					parent_id: parentId,
				});
				addNotification('Categoría actualizada', 'success');
			} else {
				await moneyApi.createCategory({
					name: name.trim(),
					type,
					parent_id: parentId ?? undefined,
				});
				addNotification('Categoría creada', 'success');
			}
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error al guardar la categoría', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{category ? 'Editar categoría' : 'Nueva categoría'}</h3>

	<div class="create-mode-toggle money-type-toggle">
		<button class="income" class:active={type === 'income'} onclick={() => (type = 'income')}
			>Ingreso</button
		>
		<button class="expense" class:active={type === 'expense'} onclick={() => (type = 'expense')}
			>Gasto</button
		>
		<button class="transfer" class:active={type === 'transfer'} onclick={() => (type = 'transfer')}
			>Transferencia</button
		>
	</div>

	<div class="detail-form">
		<div class="detail-field">
			<label for="category-name">Nombre</label>
			<input
				id="category-name"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && save()}
			/>
		</div>

		<div class="detail-field">
			<label for="category-parent">Categoría padre</label>
			<select id="category-parent" bind:value={parentId}>
				<option value={null}>Sin padre</option>
				{#each parentOptions as parent (parent.id)}
					<option value={parent.id}>{parent.label}</option>
				{/each}
			</select>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={save} disabled={saving}>
				{category ? 'Guardar' : 'Crear'}
			</button>
		</div>
	</div>
</BottomSheet>
