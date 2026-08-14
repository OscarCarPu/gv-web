<script lang="ts">
	import { onDestroy } from 'svelte';
	import LightCard from '$lib/domains/domotics/lights/LightCard.svelte';
	import { LightsController } from '$lib/domains/domotics/lights/lights.svelte';
	import type { LightInfo } from '$lib/domains/domotics/lights/api/lights.schemas';

	let { data } = $props();

	const controller = new LightsController(data.states);

	$effect(() => {
		controller.start();
		return () => controller.stop();
	});

	onDestroy(() => controller.stop());

	function infoFor(id: string): LightInfo | undefined {
		return data.lights.find((l) => l.id === id);
	}

	const summary = $derived.by(() => {
		const total = controller.states.length;
		if (total === 0) return '';
		const parts = [`${controller.onCount} of ${total} on`];
		if (controller.offlineCount > 0) parts.push(`${controller.offlineCount} unreachable`);
		return parts.join(' · ');
	});
</script>

<svelte:head>
	<title>Lights · Domotics</title>
</svelte:head>

{#if controller.states.length === 0}
	<div class="lights-empty">
		<h2>No bulbs configured</h2>
		<p>
			Set <code>LIGHTS</code> to a JSON array of bulbs and point
			<code>LIGHTS_DRIVER</code> at a driver. See <code>.env.example</code>.
		</p>
	</div>
{:else}
	<div class="lights-bar">
		<span class="lights-summary">{summary}</span>
		<div class="lights-actions">
			<button type="button" class="lights-btn" onclick={() => controller.setAll(false)}>
				All off
			</button>
			<button type="button" class="lights-btn primary" onclick={() => controller.setAll(true)}>
				All on
			</button>
		</div>
	</div>

	<div class="lights-grid">
		{#each controller.states as state (state.id)}
			{@const info = infoFor(state.id)}
			{#if info}
				<LightCard {state} {info} {controller} />
			{/if}
		{/each}
	</div>

	{#if data.driver === 'mock'}
		<p class="notice">
			Running on the <code>mock</code> driver — nothing is being sent over Bluetooth. Set
			<code>LIGHTS_DRIVER=bridge</code> and <code>LIGHTS_BRIDGE_URL</code> to drive real bulbs.
		</p>
	{/if}
{/if}
