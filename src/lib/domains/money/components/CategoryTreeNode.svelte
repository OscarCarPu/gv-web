<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { getContext } from 'svelte';
	import CategoryTreeNode from './CategoryTreeNode.svelte';
	import type { Category, CategoryTree } from '$lib/domains/money/types/Money.types';

	interface Props {
		node: CategoryTree;
		onedit: (category: Category) => void;
		ondelete: (category: Category) => void;
	}

	let { node, onedit, ondelete }: Props = $props();

	const { isExpanded, toggle } = getContext<{
		isExpanded: (id: number) => boolean;
		toggle: (id: number) => void;
	}>('money-category-tree');

	const hasChildren = $derived(node.children.length > 0);
	const expanded = $derived(isExpanded(node.id));
</script>

{#if hasChildren}
	<div class="tree-project-wrapper">
		<div class="tree-project-row">
			<button class="tree-chevron-btn" onclick={() => toggle(node.id)} aria-label="Expandir">
				<Icon name="chevron-right" class={`tree-chevron${expanded ? ' expanded' : ''}`} />
			</button>
			<Icon name="folder" class="tree-folder-icon" />
			<button class="task-name-btn" onclick={() => onedit(node)}>{node.name}</button>
		</div>
		<button class="btn-icon" title="Editar" onclick={() => onedit(node)}>
			<Icon name="pen" />
		</button>
		<button class="btn-icon" title="Eliminar" onclick={() => ondelete(node)}>
			<Icon name="trash" />
		</button>
	</div>

	{#if expanded}
		<div class="tree-children">
			{#each node.children as child (child.id)}
				<CategoryTreeNode node={child} {onedit} {ondelete} />
			{/each}
		</div>
	{/if}
{:else}
	<div class="task-item">
		<div class="task-info">
			<div class="task-name-row">
				<button class="task-name-btn" onclick={() => onedit(node)}>{node.name}</button>
			</div>
		</div>
		<div class="task-actions">
			<button class="btn-icon" title="Editar" onclick={() => onedit(node)}>
				<Icon name="pen" />
			</button>
			<button class="btn-icon" title="Eliminar" onclick={() => ondelete(node)}>
				<Icon name="trash" />
			</button>
		</div>
	</div>
{/if}
