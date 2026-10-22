<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import UptimeCard from '$lib/domains/domotics/uptime/UptimeCard.svelte';
	import { RANGE_PRESETS, UptimeController } from '$lib/domains/domotics/uptime/uptime.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const controller = new UptimeController(data.overview, data.report);
	// svelte-ignore state_referenced_locally
	let loadError = $state(data.error);

	const error = $derived(controller.error ?? loadError);
	const overview = $derived(controller.overview);

	async function refresh() {
		loadError = null;
		await controller.refresh();
	}
</script>

<svelte:head>
	<title>Uptime · Domotics</title>
</svelte:head>

<div class="uptime-bar">
	<div class="uptime-actions">
		<div class="uptime-presets">
			{#each RANGE_PRESETS as preset (preset.key)}
				<button
					type="button"
					class="uptime-preset"
					class:active={controller.preset === preset.key}
					disabled={controller.loading}
					onclick={() => controller.selectPreset(preset.key)}
				>
					{preset.label}
				</button>
			{/each}
		</div>
		<button type="button" class="uptime-btn" disabled={controller.loading} onclick={refresh}>
			<Icon name="rotate-left" />
			{controller.loading ? 'Reading…' : 'Refresh'}
		</button>
	</div>
</div>

{#if error}
	<div class="uptime-error">
		<h2>No uptime to show</h2>
		<p>{error}</p>
	</div>
{:else if !overview}
	<div class="uptime-error"><h2>No uptime to show</h2></div>
{:else}
	<div class="uptime-grid">
		<UptimeCard {overview} {controller} />
	</div>
{/if}
