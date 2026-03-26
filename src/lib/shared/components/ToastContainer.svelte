<script lang="ts">
	import { getToasts } from '$lib/shared/stores/toast.svelte';

	const toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div class="toast-container">
		{#each toasts as toast (toast.id)}
			<div class="toast" class:toast-success={toast.type === 'success'} class:toast-error={toast.type === 'error'} role="status" aria-live="polite">
				<i class="fa-solid {toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
				{toast.message}
			</div>
		{/each}
	</div>
{/if}
