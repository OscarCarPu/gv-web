<script lang="ts">
	import PrinterPanel from '$lib/domains/printers/PrinterPanel.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Printers</title>
</svelte:head>

<div class="printers-page">
	<h1>Printers</h1>

	{#if data.printers.length === 0}
		<p class="notice">No printers configured.</p>
	{:else}
		<div class="printers-grid">
			{#each data.printers as printer (printer.id)}
				<PrinterPanel id={printer.id} name={printer.name} model={printer.model} />
			{/each}
		</div>
	{/if}
</div>
