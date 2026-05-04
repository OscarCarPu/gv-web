<script lang="ts">
	import VarietyBottomSheet from '$lib/domains/varieties/components/VarietyBottomSheet.svelte';
	import VarietyCard from '$lib/domains/varieties/components/VarietyCard.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { data } = $props();
	let showCreate = $state(false);
	let highlightedId = $state<number | null>(null);

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
				<span class="text-text-muted font-mono text-xs tabular-nums">{data.varieties.length}</span>
			</div>
			{#if data.varieties.length === 0}
				<p class="text-text-muted py-6 text-center text-sm">Sin variedades aún</p>
			{:else}
				<ol class="m-0 flex list-none flex-col gap-1 p-0">
					{#each data.varieties as v, i (v.id)}
						<li>
							<button
								type="button"
								class="ranking-row"
								class:podium={i === 0}
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
				<div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
					{#each data.varieties as variety (variety.id)}
						<VarietyCard {variety} highlighted={highlightedId === variety.id} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<VarietyBottomSheet open={showCreate} onclose={() => (showCreate = false)} />
