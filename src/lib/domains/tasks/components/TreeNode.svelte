<script lang="ts">
	import type { ActiveTreeNode } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		nodes: ActiveTreeNode[];
	}

	let { nodes }: Props = $props();

	let expandedIds: Set<number> = $state(new Set());

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
	}

	function toggle(id: number) {
		if (expandedIds.has(id)) {
			expandedIds.delete(id);
		} else {
			expandedIds.add(id);
		}
		expandedIds = new Set(expandedIds);
	}
</script>

{#snippet renderNode(node: ActiveTreeNode, parentProjectName?: string, parentProjectDueAt?: string | null)}
	{@const isProject = node.type === 'project'}
	{@const hasChildren = node.children != null && node.children.length > 0}
	{@const expanded = expandedIds.has(node.id)}
	{@const isStarted = node.started_at != null}

	{#if isProject}
		<button class="tree-project-row" onclick={() => hasChildren && toggle(node.id)} disabled={!hasChildren}>
			{#if hasChildren}
				<i class="fa-solid fa-chevron-right tree-chevron" class:expanded></i>
			{/if}
			<i class="fa-solid fa-folder tree-folder-icon"></i>
			<span class="tree-project-name">{node.name}</span>
			{#if node.due_at}
				<span class="tree-project-due"><i class="fa-regular fa-calendar"></i> {formatDate(node.due_at)}</span>
			{/if}
		</button>

		{#if expanded && hasChildren}
			<div class="tree-children">
				{#each node.children! as child (child.id)}
					{@render renderNode(child, node.name, node.due_at)}
				{/each}
			</div>
		{/if}
	{:else}
		<div class="task-item">
			<div class="task-info">
				<span class="task-name">{node.name}</span>
				{#if parentProjectName}
					<span class="task-project">
						{parentProjectName}
						{#if parentProjectDueAt}
							<span class="task-project-due"><i class="fa-regular fa-calendar"></i> {formatDate(parentProjectDueAt)}</span>
						{/if}
					</span>
				{/if}
				{#if node.description}
					<span class="task-description">{node.description}</span>
				{/if}
				<div class="task-meta">
					<span class="task-status" class:started={isStarted}>
						{isStarted ? 'En progreso' : 'Pendiente'}
					</span>
					{#if node.due_at}
						<span class="task-due"><i class="fa-regular fa-calendar"></i> {formatDate(node.due_at)}</span>
					{/if}
				</div>
			</div>
			<button class="btn-primary">Iniciar</button>
		</div>
	{/if}
{/snippet}

{#each nodes as node (node.id)}
	{@render renderNode(node)}
{/each}
