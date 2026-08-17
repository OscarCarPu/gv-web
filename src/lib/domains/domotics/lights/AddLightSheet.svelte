<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import type { LightsController } from './lights.svelte';
	import type { Discovered } from './api/lights.schemas';

	/**
	 * Add a bulb: scan, pick one, name it.
	 *
	 * Scanning starts on open rather than behind a button — the sheet exists for exactly one
	 * reason, and making someone press "scan" first is a step with no decision in it.
	 */

	interface Props {
		open: boolean;
		onclose: () => void;
		controller: LightsController;
	}

	let { open, onclose, controller }: Props = $props();

	let selected = $state<Discovered | null>(null);
	let name = $state('');
	let protocol = $state('');
	let nameError = $state(false);

	$effect(() => {
		if (open) {
			selected = null;
			name = '';
			nameError = false;
			controller.loadProtocols();
			controller.scan();
		}
	});

	// Default to the only model we can drive; with several, the person picks.
	$effect(() => {
		if (!protocol && controller.protocols.length > 0) protocol = controller.protocols[0].name;
	});

	function choose(device: Discovered) {
		selected = device;
		// A lamp that advertises a name suggests one, but a room name is what people want.
		name = device.name;
		nameError = false;
	}

	async function add() {
		if (!selected) return;
		if (name.trim() === '') {
			nameError = true;
			return;
		}
		const added = await controller.add({
			name: name.trim(),
			address: selected.address,
			protocol,
		});
		if (added) selected = null;
	}

	/** Four bars of signal, so "which of these two is the one next to me" is answerable. */
	function bars(rssi: number): number {
		if (rssi >= -55) return 4;
		if (rssi >= -67) return 3;
		if (rssi >= -80) return 2;
		return 1;
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">Add a bulb</h3>

	{#if selected}
		<div class="detail-form">
			<p class="light-add-chosen">
				{selected.name || 'Unnamed bulb'}
				<span class="light-add-address">{selected.address}</span>
			</p>

			<div class="detail-field">
				<label for="light-name">Name</label>
				<input
					id="light-name"
					type="text"
					bind:value={name}
					maxlength={40}
					placeholder="Bedroom"
					class:field-error={nameError}
					oninput={() => (nameError = false)}
					onkeydown={(e) => e.key === 'Enter' && add()}
				/>
			</div>

			{#if controller.protocols.length > 1}
				<div class="detail-field">
					<label for="light-protocol">Model</label>
					<select id="light-protocol" bind:value={protocol}>
						{#each controller.protocols as info (info.name)}
							<option value={info.name}>{info.label}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="detail-actions">
				<button class="lights-btn" onclick={() => (selected = null)}>Back</button>
				<button class="btn-primary" onclick={add} disabled={controller.saving}>Add</button>
			</div>
		</div>
	{:else if controller.scanning}
		<div class="light-scan-state">
			<Icon name="spinner" spin />
			<p>Listening for bulbs…</p>
		</div>
	{:else if controller.devices.length === 0}
		<div class="light-scan-state">
			<p>Nothing in range.</p>
			<p class="light-scan-hint">
				A bulb already connected to its own app stays invisible — these lamps talk to one device at
				a time. Close that app and scan again.
			</p>
			<button class="lights-btn" onclick={() => controller.scan()}>Scan again</button>
		</div>
	{:else}
		<ul class="light-device-list">
			{#each controller.devices as device (device.address)}
				<li>
					<button
						type="button"
						class="light-device"
						disabled={device.known}
						onclick={() => choose(device)}
					>
						<span class="light-device-name">
							{device.name || 'Unnamed bulb'}
							<span class="light-add-address">{device.address}</span>
						</span>
						{#if device.known}
							<span class="light-device-known">Added</span>
						{:else}
							<span class="light-signal" title="{device.rssi} dBm" aria-label="{device.rssi} dBm">
								{#each [1, 2, 3, 4] as level (level)}
									<i class:on={level <= bars(device.rssi)}></i>
								{/each}
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		<div class="detail-actions">
			<button class="lights-btn" onclick={() => controller.scan()}>
				<Icon name="rotate-left" /> Scan again
			</button>
		</div>
	{/if}
</BottomSheet>
