<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		constrained?: boolean;
		children: Snippet;
	}

	let { open, onclose, constrained = false, children }: Props = $props();

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
	<div class="bottom-sheet-backdrop" onclick={close} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') close(); }} role="button" tabindex="-1">
		<div
			class="bottom-sheet"
			class:bottom-sheet-constrained={constrained}
			class:slide-down={closing}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<button class="bottom-sheet-close" onclick={close} aria-label="Cerrar">
				<Icon name="xmark" />
			</button>
			{@render children()}
		</div>
	</div>
{/if}
