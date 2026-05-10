<script lang="ts">
	import type { ActiveTreeNode } from '$lib/domains/tasks/types/Task.types';
	import TreeNodeItem from './TreeNodeItem.svelte';
	import { setContext } from 'svelte';
	import { formatDateShort } from '$shared/utils/datetime';

	interface Props {
		nodes: ActiveTreeNode[];
		onstart?: (
			taskId: number,
			taskName: string,
			projectName?: string,
			taskDescription?: string | null
		) => void;
		ontoggle?: (id: number, type: 'project' | 'task', action: 'start' | 'finish') => void;
		ondetail?: (id: number, type: 'project' | 'task') => void;
		oncreatetask?: (projectId: number) => void;
		isTimerRunning?: boolean;
	}

	let {
		nodes,
		onstart,
		ontoggle,
		ondetail,
		oncreatetask,
		isTimerRunning = false,
	}: Props = $props();

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

	setContext('tree-state', { isExpanded, toggle, formatDate: formatDateShort });
</script>

{#each nodes as node (`${node.type}-${node.id}`)}
	<TreeNodeItem {node} {onstart} {ontoggle} {ondetail} {oncreatetask} {isTimerRunning} />
{/each}
