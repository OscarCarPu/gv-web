<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { VarietyForm } from '$lib/domains/varieties/varietyForm.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const form = new VarietyForm(undefined, {
		onclose: () => onclose(),
		refresh: () => invalidateAll(),
	});

	$effect(() => {
		if (open) form.reset();
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">New variety</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="variety-name">Name</label>
			<input
				id="variety-name"
				type="text"
				bind:value={form.name}
				maxlength={40}
				class:field-error={form.nameError}
				oninput={() => form.clearNameError()}
				onkeydown={(e) => e.key === 'Enter' && form.create()}
			/>
		</div>

		<div class="grid [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))] gap-3">
			<div class="detail-field">
				<label for="variety-scent">Scent</label>
				<input
					id="variety-scent"
					type="number"
					min="0"
					max="10"
					step="0.1"
					bind:value={form.scent}
				/>
			</div>
			<div class="detail-field">
				<label for="variety-flavor">Flavor</label>
				<input
					id="variety-flavor"
					type="number"
					min="0"
					max="10"
					step="0.1"
					bind:value={form.flavor}
				/>
			</div>
			<div class="detail-field">
				<label for="variety-power">Potency</label>
				<input
					id="variety-power"
					type="number"
					min="0"
					max="10"
					step="0.1"
					bind:value={form.power}
				/>
			</div>
			<div class="detail-field">
				<label for="variety-quality">Effect</label>
				<input
					id="variety-quality"
					type="number"
					min="0"
					max="10"
					step="0.1"
					bind:value={form.quality}
				/>
			</div>
			<div class="detail-field">
				<label for="variety-price">Price</label>
				<input id="variety-price" type="number" min="0" step="0.01" bind:value={form.price} />
			</div>
		</div>

		<div class="detail-field">
			<label for="variety-judge">Rated by</label>
			<input id="variety-judge" type="text" bind:value={form.judge} maxlength={40} />
		</div>

		<div class="detail-field">
			<label for="variety-comments">Comments</label>
			<textarea id="variety-comments" bind:value={form.comments} rows="3"></textarea>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={() => form.create()} disabled={form.saving}
				>Create</button
			>
		</div>
	</div>
</BottomSheet>
