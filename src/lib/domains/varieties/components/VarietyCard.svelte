<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { Variety } from '$lib/domains/varieties/types/Variety.types';
	import { VarietyCard as VarietyCardController } from '$lib/domains/varieties/components/varietyCard.svelte';
	import { linkify } from '$lib/shared/utils/linkify';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		variety: Variety;
		highlighted?: boolean;
	}

	let { variety, highlighted = false }: Props = $props();

	// Seed the controller from the initial `variety` snapshot (mirrors the
	// original component's `untrack(() => variety)` field seeding).
	const card = untrack(
		() => new VarietyCardController(variety, { refresh: () => invalidateAll() })
	);

	let textareaEl: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (card.editingComments && textareaEl) textareaEl.focus();
	});
</script>

<article
	id={`variety-card-${variety.id}`}
	class="variety-card"
	class:saving={card.saving}
	class:highlight={highlighted}
>
	<input
		class="text-text focus:bg-bg rounded-md border-none bg-transparent px-1 py-1 text-base font-bold transition-colors outline-none"
		type="text"
		bind:value={card.name}
		oninput={() => card.scheduleSave()}
		maxlength={40}
		aria-label="Variety name"
	/>

	<div class="score-grid">
		<div class="detail-field">
			<label for={`scent-${variety.id}`}>Scent</label>
			<input
				id={`scent-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={card.scent}
				oninput={() => card.scheduleSave()}
			/>
		</div>
		<div class="detail-field">
			<label for={`flavor-${variety.id}`}>Flavor</label>
			<input
				id={`flavor-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={card.flavor}
				oninput={() => card.scheduleSave()}
			/>
		</div>
		<div class="detail-field">
			<label for={`power-${variety.id}`}>Potency</label>
			<input
				id={`power-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={card.power}
				oninput={() => card.scheduleSave()}
			/>
		</div>
		<div class="detail-field">
			<label for={`quality-${variety.id}`}>Effect</label>
			<input
				id={`quality-${variety.id}`}
				type="number"
				min="0"
				max="10"
				step="0.1"
				bind:value={card.quality}
				oninput={() => card.scheduleSave()}
			/>
		</div>
	</div>

	<div class="detail-field">
		<label for={`price-${variety.id}`}>Price</label>
		<input
			id={`price-${variety.id}`}
			type="number"
			min="0"
			step="0.01"
			bind:value={card.price}
			oninput={() => card.scheduleSave()}
		/>
	</div>

	<div class="detail-field">
		<div class="detail-field-header">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label>Comments</label>
			{#if !card.editingComments && variety.comments}
				<button
					class="desc-edit-btn"
					onclick={() => card.startEditingComments()}
					type="button"
					aria-label="Edit comments"
				>
					<Icon name="pen" />
				</button>
			{/if}
		</div>
		{#if card.editingComments}
			<textarea
				bind:this={textareaEl}
				bind:value={card.comments}
				rows="3"
				onblur={() => card.commitCommentsEdit()}
			></textarea>
		{:else if variety.comments}
			<div class="desc-view">{@html linkify(variety.comments)}</div>
		{:else}
			<button class="comments-empty" onclick={() => card.startEditingComments()} type="button">
				Add comments...
			</button>
		{/if}
	</div>

	<footer class="flex items-center justify-between gap-2 pt-1">
		<span class="score-badge" title="Score">{variety.score.toFixed(2)}</span>
		<label class="judge-label flex min-w-0 flex-1 items-baseline gap-1 text-xs">
			<span class="text-text-muted shrink-0">Rated by</span>
			<input
				class="text-text focus:bg-bg min-w-0 flex-1 rounded-md border-none bg-transparent px-1 py-0.5 font-medium transition-colors outline-none"
				type="text"
				bind:value={card.judge}
				oninput={() => card.scheduleSave()}
				maxlength={40}
				aria-label="Judge"
			/>
		</label>
		<button
			class="btn-icon hover:text-danger"
			onclick={() => card.remove()}
			aria-label="Delete variety"
			title="Eliminar"
		>
			<Icon name="trash" />
		</button>
	</footer>
</article>
