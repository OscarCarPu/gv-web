<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { varietiesApi } from '$lib/domains/varieties/api/varieties.api';
	import type { Variety } from '$lib/domains/varieties/types/Variety.types';
	import { linkify } from '$lib/shared/utils/linkify';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		variety: Variety;
		highlighted?: boolean;
	}

	let { variety, highlighted = false }: Props = $props();

	const init = untrack(() => variety);
	let name = $state(init.name);
	let scent = $state<number | null>(init.scent);
	let flavor = $state<number | null>(init.flavor);
	let power = $state<number | null>(init.power);
	let quality = $state<number | null>(init.quality);
	let price = $state<number | null>(init.price);
	let comments = $state(init.comments ?? '');
	let editingComments = $state(false);

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saving = $state(false);
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (editingComments && textareaEl) textareaEl.focus();
	});

	function clamp(v: number | null): number {
		if (v === null || Number.isNaN(v)) return 0;
		return Math.max(0, Math.min(10, v));
	}

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 400);
	}

	async function save() {
		saveTimer = null;
		saving = true;
		try {
			await varietiesApi.updateVariety(variety.id, {
				name: name.trim() || variety.name,
				scent: clamp(scent),
				flavor: clamp(flavor),
				power: clamp(power),
				quality: clamp(quality),
				price: price ?? 0,
				comments: comments.trim() ? comments.trim() : null,
			});
			addNotification('Variedad actualizada', 'success');
			invalidate('app:varieties');
		} catch {
			addToast('Error al guardar', 'error');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		try {
			await varietiesApi.deleteVariety(variety.id);
			addNotification('Variedad eliminada', 'success');
			invalidate('app:varieties');
		} catch {
			addToast('Error al eliminar', 'error');
		}
	}

	async function commitCommentsEdit() {
		editingComments = false;
		const next = comments.trim() ? comments.trim() : null;
		if (next !== (variety.comments ?? null)) {
			if (saveTimer) clearTimeout(saveTimer);
			await save();
		}
	}
</script>

<article
	id={`variety-card-${variety.id}`}
	class="variety-card"
	class:saving
	class:highlight={highlighted}
>
	<input
		class="text-text focus:bg-bg rounded-md border-none bg-transparent px-1 py-1 text-base font-bold transition-colors outline-none"
		type="text"
		bind:value={name}
		oninput={scheduleSave}
		maxlength={40}
		aria-label="Nombre de la variedad"
	/>

	<div class="score-grid">
		<div class="detail-field">
			<label for={`scent-${variety.id}`}>Aroma</label>
			<input
				id={`scent-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={scent}
				oninput={scheduleSave}
			/>
		</div>
		<div class="detail-field">
			<label for={`flavor-${variety.id}`}>Sabor</label>
			<input
				id={`flavor-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={flavor}
				oninput={scheduleSave}
			/>
		</div>
		<div class="detail-field">
			<label for={`power-${variety.id}`}>Potencia</label>
			<input
				id={`power-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={power}
				oninput={scheduleSave}
			/>
		</div>
		<div class="detail-field">
			<label for={`quality-${variety.id}`}>Efecto</label>
			<input
				id={`quality-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={quality}
				oninput={scheduleSave}
			/>
		</div>
	</div>

	<div class="detail-field">
		<label for={`price-${variety.id}`}>Precio</label>
		<input
			id={`price-${variety.id}`}
			type="number"
			min="0"
			step="0.01"
			bind:value={price}
			oninput={scheduleSave}
		/>
	</div>

	<div class="detail-field">
		<div class="detail-field-header">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label>Comentarios</label>
			{#if !editingComments && variety.comments}
				<button
					class="desc-edit-btn"
					onclick={() => (editingComments = true)}
					type="button"
					aria-label="Editar comentarios"
				>
					<Icon name="pen" />
				</button>
			{/if}
		</div>
		{#if editingComments}
			<textarea bind:this={textareaEl} bind:value={comments} rows="3" onblur={commitCommentsEdit}
			></textarea>
		{:else if variety.comments}
			<div class="desc-view">{@html linkify(variety.comments)}</div>
		{:else}
			<button class="comments-empty" onclick={() => (editingComments = true)} type="button">
				Añadir comentarios…
			</button>
		{/if}
	</div>

	<footer class="flex items-center justify-between gap-2 pt-1">
		<span class="score-badge" title="Puntuación">{variety.score.toFixed(2)}</span>
		<button
			class="btn-icon hover:text-danger"
			onclick={handleDelete}
			aria-label="Eliminar variedad"
			title="Eliminar"
		>
			<Icon name="trash" />
		</button>
	</footer>
</article>
