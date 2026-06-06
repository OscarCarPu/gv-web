<script lang="ts">
	import VarietyBottomSheet from '$lib/domains/varieties/components/VarietyBottomSheet.svelte';
	import VarietyCard from '$lib/domains/varieties/components/VarietyCard.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { VarietiesBoard } from '$lib/domains/varieties/varietiesBoard.svelte';

	let { data } = $props();

	const board = new VarietiesBoard(() => data.varieties);

	function focusVariety(id: number) {
		const el = document.getElementById(`variety-card-${id}`);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		board.highlight(id);
	}
</script>

<svelte:head>
	<title>Maria</title>
</svelte:head>

<div class="container">
	<h1>Varieties</h1>

	<div class="varieties-layout">
		<aside class="ranking-list">
			<div class="section-header">
				<h2>Ranking</h2>
				<span class="text-text-muted font-mono text-xs tabular-nums">{board.rated.length}</span>
			</div>
			{#if board.rated.length === 0}
				<p class="text-text-muted py-6 text-center text-sm">No rated varieties</p>
			{:else}
				<ol class="m-0 flex list-none flex-col gap-1 p-0">
					{#each board.rated as v, i (v.id)}
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

			{#if board.unrated.length > 0}
				<div class="section-header mt-5">
					<h2>To rate</h2>
					<span class="text-text-muted font-mono text-xs tabular-nums">{board.unrated.length}</span>
				</div>
				<ul class="m-0 flex list-none flex-col gap-1 p-0">
					{#each board.unrated as v (v.id)}
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
				<h2>Varieties</h2>
				<button class="btn-primary btn-sm" onclick={() => board.openCreate()}>
					<Icon name="plus" /> Variety
				</button>
			</div>

			{#if data.varieties.length === 0}
				<p class="text-text-muted py-12 text-center text-sm">
					No varieties yet. Press <strong>+</strong> to add the first one.
				</p>
			{:else}
				<div class="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-4">
					{#each data.varieties as variety (variety.id)}
						<VarietyCard {variety} highlighted={board.highlightedId === variety.id} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

<VarietyBottomSheet open={board.showCreate} onclose={() => board.closeCreate()} />
