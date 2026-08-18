<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import LightCard from '$lib/domains/domotics/lights/LightCard.svelte';
	import AddLightSheet from '$lib/domains/domotics/lights/AddLightSheet.svelte';
	import EditLightSheet from '$lib/domains/domotics/lights/EditLightSheet.svelte';
	import { LightsController } from '$lib/domains/domotics/lights/lights.svelte';
	import type { LightInfo } from '$lib/domains/domotics/lights/api/lights.schemas';

	let { data } = $props();

	// SSR values are a seed; the controller polls from here on.
	// svelte-ignore state_referenced_locally
	const controller = new LightsController(data.lights, data.states);

	let adding = $state(false);
	let editing = $state<LightInfo | null>(null);

	$effect(() => {
		controller.start();
		return () => controller.stop();
	});

	onDestroy(() => controller.stop());

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

<div class="lights-bar">
	<span class="lights-summary">{summary}</span>
	<div class="lights-actions">
		{#if controller.states.length > 0}
			<button type="button" class="lights-btn" onclick={() => controller.setAll(false)}>
				All off
			</button>
			<button type="button" class="lights-btn primary" onclick={() => controller.setAll(true)}>
				All on
			</button>
		{/if}
		<button type="button" class="lights-btn" onclick={() => (adding = true)}>
			<Icon name="plus" /> Add bulb
		</button>
	</div>
</div>

{#if controller.states.length === 0}
	<div class="lights-empty">
		<h2>No bulbs yet</h2>
		<p>
			Scan for what is in range and give it a name. The bulb has to be powered and not connected to
			any other app.
		</p>
		<button type="button" class="lights-btn primary" onclick={() => (adding = true)}>
			<Icon name="plus" /> Add bulb
		</button>
	</div>
{:else}
	<div class="lights-grid">
		{#each controller.states as state (state.id)}
			{@const info = controller.infoFor(state.id)}
			{#if info}
				<LightCard {state} {info} {controller} onedit={() => (editing = info)} />
			{/if}
		{/each}
	</div>
{/if}

<AddLightSheet open={adding} onclose={() => (adding = false)} {controller} />
<EditLightSheet
	open={editing !== null}
	onclose={() => (editing = null)}
	{controller}
	light={editing}
/>
