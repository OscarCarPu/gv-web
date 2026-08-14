<script lang="ts">
	import PrinterPanel from '$lib/domains/domotics/printers/PrinterPanel.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Printers · Domotics</title>
</svelte:head>

{#if data.printers.length === 0}
	<p class="notice">No printers configured.</p>
{:else}
	<div class="printers-grid">
		{#each data.printers as printer (printer.id)}
			<PrinterPanel id={printer.id} name={printer.name} model={printer.model} />
		{/each}
	</div>
{/if}
