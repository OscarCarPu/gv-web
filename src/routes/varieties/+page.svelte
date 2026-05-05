<script lang="ts">
	import VarietyBottomSheet from '$lib/domains/varieties/components/VarietyBottomSheet.svelte';
	import VarietyCard from '$lib/domains/varieties/components/VarietyCard.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import type { Variety } from '$lib/domains/varieties/types/Variety.types';

	let { data } = $props();
	let showCreate = $state(false);
	let highlightedId = $state<number | null>(null);

	function isRated(v: Variety) {
		return v.scent > 0 && v.flavor > 0 && v.power > 0 && v.quality > 0;
	}

	let rated = $derived(data.varieties.filter(isRated));
	let unrated = $derived(data.varieties.filter((v) => !isRated(v)));

	function focusVariety(id: number) {
		const el = document.getElementById(`variety-card-${id}`);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		highlightedId = id;
		setTimeout(() => {
			if (highlightedId === id) highlightedId = null;
		}, 1500);
	}
</script>

<svelte:head>
	<title>Maria</title>
</svelte:head>

<div class="container">
	<h1>Maria</h1>

	<div class="varieties-layout">
		<aside class="ranking-list">
			<div class="section-header">
				<h2>Ranking</h2>
				<span class="text-text-muted font-mono text-xs tabular-nums">{rated.length}</span>
			</div>
			{#if rated.length === 0}
				<p class="text-text-muted py-6 text-center text-sm">Sin variedades puntuadas</p>
			{:else}
				<ol class="m-0 flex list-none flex-col gap-1 p-0">
					{#each rated as v, i (v.id)}
						<li>
							<button
								type="button"
								class="ranking-row"
								class:podium={i === 0}
								class:silver={i === 1}
								class:bronze={i === 2}
								onclick={() => focusVariety(v.id)}
							>
								<span class="ranking-rank">#{i + 1}</span>
								<span class="ranking-name">{v.name}</span>
								<span class="ranking-score">{v.score.toFixed(2)}</span>
								<span class="ranking-price">{v.price.toFixed(2)}€</span>
							</button>
						</li>
					{/each}
				</ol>
			{/if}

			{#if unrated.length > 0}
				<div class="section-header mt-5">
					<h2>Por puntuar</h2>
					<span class="text-text-muted font-mono text-xs tabular-nums">{unrated.length}</span>
				</div>
				<ul class="m-0 flex list-none flex-col gap-1 p-0">
					{#each unrated as v (v.id)}
						<li>
							<button type="button" class="ranking-row" onclick={() => focusVariety(v.id)}>
								<span class="ranking-rank">—</span>
								<span class="ranking-name">{v.name}</span>
								<span class="ranking-price">{v.price.toFixed(2)}€</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>

		<section>
			<div class="section-header">
				<h2>Variedades</h2>
				<button class="btn-primary btn-sm" onclick={() => (showCreate = true)}>
					<Icon name="plus" /> Variedad
				</button>
			</div>

			{#if data.varieties.length === 0}
				<p class="text-text-muted py-12 text-center text-sm">
					Aún no hay variedades. Pulsa <strong>+</strong> para añadir la primera.
				</p>
			{:else}
				<div class="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-4">
					{#each data.varieties as variety (variety.id)}
						<VarietyCard {variety} highlighted={highlightedId === variety.id} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<VarietyBottomSheet open={showCreate} onclose={() => (showCreate = false)} />
