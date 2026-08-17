<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import type { LightsController } from './lights.svelte';
	import type { LightInfo } from './api/lights.schemas';

	/**
	 * Rename or remove one bulb.
	 *
	 * Removing is immediate and has no confirmation, like every other destructive action here.
	 * Nothing is lost: the lamp keeps working, and adding it back is a scan away.
	 */

	interface Props {
		open: boolean;
		onclose: () => void;
		controller: LightsController;
		light: LightInfo | null;
	}

	let { open, onclose, controller, light }: Props = $props();

	let name = $state('');
	let nameError = $state(false);

	$effect(() => {
		if (open && light) {
			name = light.name;
			nameError = false;
		}
	});

	async function save() {
		if (!light) return;
		if (name.trim() === '') {
			nameError = true;
			return;
		}
		if (name.trim() === light.name) {
			onclose();
			return;
		}
		if (await controller.edit(light.id, { name: name.trim() })) onclose();
	}

	async function remove() {
		if (!light) return;
		if (await controller.remove(light.id)) onclose();
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{light?.name ?? 'Bulb'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="light-rename">Name</label>
			<input
				id="light-rename"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && save()}
			/>
		</div>

		<p class="light-edit-model">{light?.model}</p>

		<div class="detail-actions">
			<button class="lights-btn danger" onclick={remove} disabled={controller.saving}>
				<Icon name="trash" /> Remove
			</button>
			<button class="btn-primary" onclick={save} disabled={controller.saving}>Save</button>
		</div>
	</div>
</BottomSheet>
