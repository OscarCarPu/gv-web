<script lang="ts">
	import type { TaskDepRef } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		deps: TaskDepRef[];
		ondetail?: (taskId: number) => void;
	}

	let { deps, ondetail }: Props = $props();
</script>

{#if deps.length > 0}
	<div class="dep-badges">
		{#each deps as dep (dep.id)}
			<button class="dep-badge" onclick={() => ondetail?.(dep.id)}>
				{dep.name}
			</button>
		{/each}
	</div>
{/if}
