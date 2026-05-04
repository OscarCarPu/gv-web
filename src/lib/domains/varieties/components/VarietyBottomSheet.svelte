<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { varietiesApi } from '$lib/domains/varieties/api/varieties.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let name = $state('');
	let scent = $state<number | null>(null);
	let flavor = $state<number | null>(null);
	let power = $state<number | null>(null);
	let quality = $state<number | null>(null);
	let price = $state<number | null>(null);
	let comments = $state('');
	let saving = $state(false);
	let nameError = $state(false);

	$effect(() => {
		if (open) {
			name = '';
			scent = null;
			flavor = null;
			power = null;
			quality = null;
			price = null;
			comments = '';
			nameError = false;
		}
	});

	function clamp(v: number | null): number {
		if (v === null || Number.isNaN(v)) return 0;
		return Math.max(0, Math.min(10, v));
	}

	async function create() {
		if (!name.trim()) {
			nameError = true;
			return;
		}
		saving = true;
		try {
			await varietiesApi.createVariety({
				name: name.trim(),
				scent: clamp(scent),
				flavor: clamp(flavor),
				power: clamp(power),
				quality: clamp(quality),
				price: price ?? 0,
				comments: comments.trim() ? comments.trim() : null,
			});
			addNotification('Variedad creada', 'success');
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error al crear', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">Nueva variedad</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="variety-name">Nombre</label>
			<input
				id="variety-name"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && create()}
			/>
		</div>

		<div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
			<div class="detail-field">
				<label for="variety-scent">Aroma</label>
				<input id="variety-scent" type="number" min="0" max="10" step="0.1" bind:value={scent} />
			</div>
			<div class="detail-field">
				<label for="variety-flavor">Sabor</label>
				<input id="variety-flavor" type="number" min="0" max="10" step="0.1" bind:value={flavor} />
			</div>
			<div class="detail-field">
				<label for="variety-power">Potencia</label>
				<input id="variety-power" type="number" min="0" max="10" step="0.1" bind:value={power} />
			</div>
			<div class="detail-field">
				<label for="variety-quality">Efecto</label>
				<input id="variety-quality" type="number" min="0" max="10" step="0.1" bind:value={quality} />
			</div>
			<div class="detail-field">
				<label for="variety-price">Precio</label>
				<input id="variety-price" type="number" min="0" step="0.01" bind:value={price} />
			</div>
		</div>

		<div class="detail-field">
			<label for="variety-comments">Comentarios</label>
			<textarea id="variety-comments" bind:value={comments} rows="3"></textarea>
		</div>

		<div class="detail-actions">
			<button class="btn-primary" onclick={create} disabled={saving}>Crear</button>
		</div>
	</div>
</BottomSheet>
