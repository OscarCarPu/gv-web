<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let { open, onclose, children }: Props = $props();

	let closing = $state(false);
	let visible = $state(false);

	$effect(() => {
		if (open) {
			visible = true;
			closing = false;
		} else if (visible && !closing) {
			closing = true;
			setTimeout(() => {
				closing = false;
				visible = false;
			}, 250);
		}
	});

	function close() {
		closing = true;
		setTimeout(() => {
			closing = false;
			visible = false;
			onclose();
		}, 250);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
	<div
		class="right-sheet-backdrop"
		onclick={close}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') close();
		}}
		role="button"
		tabindex="-1"
	>
		<div
			class="right-sheet"
			class:slide-out-right={closing}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<button class="right-sheet-close" onclick={close} aria-label="Cerrar">
				<Icon name="xmark" />
			</button>
			{@render children()}
		</div>
	</div>
{/if}
