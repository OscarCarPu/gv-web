<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import UptimeCard from '$lib/domains/domotics/uptime/UptimeCard.svelte';
	import { RANGE_PRESETS, UptimeController } from '$lib/domains/domotics/uptime/uptime.svelte';
	import { formatAgo } from '$lib/domains/domotics/uptime/format';

	let { data } = $props();

	// SSR values seed the controller; nothing polls here — the marts only move when dbt runs.
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
	<div class="uptime-freshness">
		{#if overview}
			<!-- computed_at is the dbt run time, not now. Saying so is the whole point of showing
			     it: these percentages are a snapshot of a batch job. -->
			<span class:is-stale={controller.stale}>
				{#if controller.stale}
					<Icon name="circle-exclamation" />
				{/if}
				Computed {formatAgo(overview.computed_at)}
			</span>
			{#if controller.stale}
				<span class="uptime-stale-note">not live — the pipeline runs in batches</span>
			{/if}
		{/if}
	</div>

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
		<p class="uptime-error-hint">
			The numbers come from central-pipeline's database. gv-api needs
			<code>PIPELINE_DATABASE_URL</code> pointed at it; until then this tab has nothing to read.
		</p>
	</div>
{:else if !overview}
	<div class="uptime-error"><h2>No uptime to show</h2></div>
{:else}
	<div class="uptime-grid">
		{#each overview.devices as device (device.device)}
			<UptimeCard {device} {controller} />
		{/each}
	</div>
{/if}
