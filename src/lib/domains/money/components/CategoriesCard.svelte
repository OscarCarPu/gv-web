<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { setContext } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import CategoryTreeNode from './CategoryTreeNode.svelte';
	import CategoryFormSheet from './CategoryFormSheet.svelte';
	import type {
		Category,
		CategoryTree,
		TransactionType,
	} from '$lib/domains/money/types/Money.types';

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
		{ type: 'income', label: 'Ingresos' },
		{ type: 'expense', label: 'Gastos' },
		{ type: 'transfer', label: 'Transferencias' },
	];

	function buildTree(items: Category[]): CategoryTree[] {
		const byId = new Map<number, CategoryTree>();
		const roots: CategoryTree[] = [];
		items.forEach((c) => byId.set(c.id, { ...c, children: [] }));
		items.forEach((c) => {
			const node = byId.get(c.id)!;
			if (c.parent_id != null && byId.has(c.parent_id)) {
				byId.get(c.parent_id)!.children.push(node);
			} else {
				roots.push(node);
			}
		});
		return roots;
	}

	let groups = $derived(
		TYPE_ORDER.map(({ type, label }) => ({
			type,
			label,
			roots: buildTree(categories.filter((c) => c.type === type)),
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
		try {
			await moneyApi.deleteCategory(category.id);
			addNotification('Categoría eliminada', 'success');
			await invalidateAll();
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (msg.includes('referenced')) {
				addToast('La categoría está en uso', 'error');
			} else {
				addToast('Error al eliminar la categoría', 'error');
			}
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Categorías</h2>
		<button class="btn-action-sm" onclick={openCreate}>
			<Icon name="plus" /> Nueva
		</button>
	</div>

	{#if categories.length === 0}
		<div class="project-children-empty">Sin categorías</div>
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
