<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { setContext } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { buildCategoryTree } from '$lib/domains/money/utils/categoryTree';
	import { deleteWithConflict } from '$lib/domains/money/utils/deleteConflict';
	import CategoryTreeNode from './CategoryTreeNode.svelte';
	import CategoryFormSheet from './CategoryFormSheet.svelte';
	import type { Category, TransactionType } from '$lib/domains/money/types/Money.types';

	interface Props {
		categories: Category[];
	}

	let { categories }: Props = $props();

	let sheetOpen = $state(false);
	let editing = $state<Category | null>(null);

	let expandedIds: Set<number> = $state(new Set());

	function toggle(id: number) {
		if (expandedIds.has(id)) {
			expandedIds.delete(id);
		} else {
			expandedIds.add(id);
		}
		expandedIds = new Set(expandedIds);
	}

	function isExpanded(id: number): boolean {
		return expandedIds.has(id);
	}

	setContext('money-category-tree', { isExpanded, toggle });

	const TYPE_ORDER: { type: TransactionType; label: string }[] = [
		{ type: 'income', label: 'Income' },
		{ type: 'expense', label: 'Expenses' },
		{ type: 'transfer', label: 'Transfers' },
	];

	let groups = $derived(
		TYPE_ORDER.map(({ type, label }) => ({
			type,
			label,
			roots: buildCategoryTree(categories.filter((c) => c.type === type)),
			count: categories.filter((c) => c.type === type).length,
		}))
	);

	function openCreate() {
		editing = null;
		sheetOpen = true;
	}

	function openEdit(category: Category) {
		editing = category;
		sheetOpen = true;
	}

	async function onDelete(category: Category) {
		const { ok, conflict } = await deleteWithConflict({
			run: () => moneyApi.deleteCategory(category.id),
			needles: ['referenced'],
		});
		if (ok) {
			addNotification('Category deleted', 'success');
			await invalidateAll();
		} else if (conflict) {
			addToast('Category is in use', 'error');
		} else {
			addToast('Error deleting category', 'error');
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Categories</h2>
		<button class="btn-action-sm" onclick={openCreate}>
			<Icon name="plus" /> New
		</button>
	</div>

	{#if categories.length === 0}
		<div class="project-children-empty">No categories</div>
	{:else}
		<div class="money-category-groups">
			{#each groups as group (group.type)}
				{#if group.count > 0}
					<div class="money-category-group">
						<h3 class="money-group-label">{group.label}</h3>
						<div class="task-list">
							{#each group.roots as root (root.id)}
								<CategoryTreeNode node={root} onedit={openEdit} ondelete={onDelete} />
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</section>

<CategoryFormSheet
	open={sheetOpen}
	onclose={() => (sheetOpen = false)}
	category={editing}
	{categories}
/>
