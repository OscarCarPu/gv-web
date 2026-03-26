<script lang="ts">
	let { icon = 'fa-solid fa-note-sticky', text }: { icon?: string; text: string } = $props();

	let visible = $state(true);

	$effect(() => {
		const timer = setTimeout(() => { visible = false; }, 60000);
		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div class="floating-reminder" role="status" aria-live="polite">
		<i class={icon}></i>
		{text}
		<button
			class="ml-2 bg-transparent border-none text-text-muted hover:text-text cursor-pointer text-xs transition-colors"
			onclick={() => visible = false}
			aria-label="Cerrar"
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	</div>
{/if}
