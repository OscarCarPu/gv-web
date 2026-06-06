<script lang="ts">
	import { onMount } from 'svelte';
	import { geoMercator, geoPath } from 'd3-geo';
	import type {
		GaliciaGeoJSON,
		ConcelhoFeature,
		RutasMark,
	} from '$lib/domains/rutas/types/Rutas.types';
	import { RutasMarks } from '$lib/domains/rutas/rutasMarks.svelte';

	let { data }: { data: { marks: RutasMark[] } } = $props();

	const marks = new RutasMarks(data.marks ?? []);

	// GeoJSON state
	let geojson = $state<GaliciaGeoJSON | null>(null);
	let loadError = $state(false);

	// Map render state
	let svgEl: SVGSVGElement;
	let paths: { feature: ConcelhoFeature; d: string }[] = $state([]);

	// Province filter
	const PROVINCES = ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra'];

	// Modal form fields (bound to inputs; seeded when the modal opens)
	let formDate = $state('');
	let formDescription = $state('');

	// Derived counts — update when province filter changes
	let visibleFeatures = $derived(
		geojson
			? marks.activeProvince
				? geojson.features.filter((f) => f.properties.province === marks.activeProvince)
				: geojson.features
			: []
	);
	let visibleTotal = $derived(visibleFeatures.length);
	let visibleVisited = $derived(visibleFeatures.filter((f) => marks.has(f.properties.name)).length);

	function buildPaths(data: GaliciaGeoJSON, w: number, h: number) {
		if (!data.features.length || w === 0 || h === 0) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const projection = geoMercator().fitSize([w, h], data as any);
		const pathGen = geoPath(projection);
		paths = data.features
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.map((feature) => ({ feature, d: pathGen(feature as any) ?? '' }))
			.filter((p) => p.d !== '');
	}

	function openModal(feature: ConcelhoFeature) {
		const existing = marks.get(feature.properties.name);
		formDate = existing?.date ?? '';
		formDescription = existing?.description ?? '';
		marks.openModal(feature);
	}

	function saveModal() {
		const feature = marks.selectedFeature;
		if (!feature || !formDate) return;
		marks.save(feature.properties.name, {
			visited_on: formDate,
			description: formDescription,
		});
	}

	function removeMark() {
		const feature = marks.selectedFeature;
		if (!feature) return;
		marks.remove(feature.properties.name);
	}

	onMount(() => {
		let ro: ResizeObserver | null = null;
		let latestGeoJSON: GaliciaGeoJSON | null = null;

		function render() {
			if (!svgEl || !latestGeoJSON) return;
			const w = svgEl.clientWidth || svgEl.getBoundingClientRect().width;
			const h = svgEl.clientHeight || svgEl.getBoundingClientRect().height;
			if (w > 0 && h > 0) buildPaths(latestGeoJSON, w, h);
		}

		ro = new ResizeObserver(render);
		ro.observe(svgEl);

		// Load GeoJSON client-side to avoid 900 KB SSR serialisation
		fetch('/galicia-concellos.json')
			.then((r) => {
				if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
				return r.json() as Promise<GaliciaGeoJSON>;
			})
			.then((geoData) => {
				latestGeoJSON = geoData;
				geojson = geoData;
				render();
			})
			.catch((e) => {
				console.error('Failed to load GeoJSON:', e);
				loadError = true;
			});

		return () => ro?.disconnect();
	});
</script>

<svelte:head>
	<title>Routes</title>
</svelte:head>

<div class="rutas-page container">
	<div class="rutas-header">
		<div class="rutas-title-row">
			<h1>Routes</h1>
			<span class="rutas-counter">{visibleVisited}/{visibleTotal}</span>
		</div>
		<div class="rutas-filters">
			<button
				class="province-btn"
				class:active={marks.activeProvince === null}
				onclick={() => marks.clearProvince()}
			>
				All
			</button>
			{#each PROVINCES as prov}
				<button
					class="province-btn"
					class:active={marks.activeProvince === prov}
					onclick={() => marks.setProvince(marks.activeProvince === prov ? null : prov)}
				>
					{prov}
				</button>
			{/each}
		</div>
	</div>

	<div class="rutas-map-container">
		{#if loadError}
			<p class="rutas-map-error">Failed to load map data.</p>
		{:else if !geojson}
			<p class="rutas-map-loading">Loading map…</p>
		{/if}
		<svg
			bind:this={svgEl}
			class="rutas-map"
			width="100%"
			height="100%"
			aria-label="Map of Galicia's municipalities"
		>
			{#each paths as { feature, d }}
				{@const mark = marks.get(feature.properties.name)}
				{@const isVisible =
					!marks.activeProvince || feature.properties.province === marks.activeProvince}
				<path
					{d}
					class="concello-path"
					class:marked={!!mark}
					class:dimmed={!isVisible}
					onclick={() => openModal(feature)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && openModal(feature)}
					aria-label={feature.properties.name}
					aria-pressed={!!mark}
				>
					<title>{feature.properties.name}{mark ? ` — ${mark.date}` : ''}</title>
				</path>
			{/each}
		</svg>
	</div>

	<!-- Visited list -->
	{#if marks.marks.size > 0}
		<div class="rutas-visited">
			<p class="rutas-section-title">Visited ({marks.marks.size})</p>
			<ul class="rutas-visited-list">
				{#each [...marks.marks.values()].sort((a, b) => a.date.localeCompare(b.date)) as mark}
					{@const feature = geojson?.features.find((f) => f.properties.name === mark.name)}
					{#if feature}
						<li class="rutas-visited-item">
							<button class="rutas-visited-btn" onclick={() => openModal(feature)} type="button">
								<span class="rutas-visited-name">{feature.properties.name}</span>
								<span class="rutas-visited-meta">
									<span class="rutas-visited-date">{mark.date}</span>
									{#if mark.description}
										<span class="rutas-visited-desc">{mark.description}</span>
									{/if}
								</span>
							</button>
						</li>
					{/if}
				{/each}
			</ul>
		</div>
	{/if}
</div>

<!-- Mark modal -->
{#if marks.modalOpen && marks.selectedFeature}
	<div class="rutas-modal-wrapper">
		<button
			class="rutas-modal-backdrop"
			type="button"
			onclick={() => marks.closeModal()}
			aria-label="Close dialog"
		></button>
		<div
			class="rutas-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			tabindex="-1"
		>
			<div class="rutas-modal-header">
				<div>
					<h3 class="rutas-modal-title" id="modal-title">
						{marks.selectedFeature.properties.name}
					</h3>
					<p class="rutas-modal-province">{marks.selectedFeature.properties.province}</p>
				</div>
				<button class="sheet-close" onclick={() => marks.closeModal()} aria-label="Close">✕</button>
			</div>

			<div class="rutas-modal-body">
				<label class="rutas-form-label" for="mark-date">Date visited</label>
				<input id="mark-date" type="date" class="rutas-date-input" bind:value={formDate} />

				<label class="rutas-form-label" for="mark-desc">Description</label>
				<textarea
					id="mark-desc"
					class="rutas-desc-input"
					placeholder="Notes about this visit..."
					bind:value={formDescription}
					rows="3"
				></textarea>
			</div>

			<div class="rutas-modal-footer">
				{#if marks.has(marks.selectedFeature.properties.name)}
					<button class="btn-danger" type="button" onclick={removeMark} disabled={marks.saving}
						>Remove</button
					>
				{/if}
				<button class="btn-secondary" type="button" onclick={() => marks.closeModal()}
					>Cancel</button
				>
				<button
					class="btn-primary"
					type="button"
					onclick={saveModal}
					disabled={!formDate || marks.saving}
				>
					{marks.saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
