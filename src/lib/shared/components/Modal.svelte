<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		children: Snippet;
		wide?: boolean;
		narrow?: boolean;
	}

	let { open, onclose, children, wide = false, narrow = false }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="modal-backdrop"
		onclick={onclose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onclose?.();
		}}
		role="button"
		tabindex="-1"
	>
		<div
			class="modal-card"
			class:modal-card-wide={wide}
			class:modal-card-narrow={narrow}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			{@render children()}
		</div>
	</div>
{/if}
