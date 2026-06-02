<script lang="ts">
	import { onMount } from 'svelte';
	import { geoMercator, geoPath } from 'd3-geo';
	import { addToast } from '$shared/stores/toast.svelte';
	import type { GaliciaGeoJSON, LocalMark, ConcelhoFeature, RutasMark } from '$lib/domains/rutas/types/Rutas.types';
	import { rutasApi } from '$lib/domains/rutas/api/rutas.api';

	let { data }: { data: { marks: RutasMark[] } } = $props();

	function marksFromApi(apiMarks: RutasMark[]): Map<string, LocalMark> {
		const m = new Map<string, LocalMark>();
		for (const mark of apiMarks) {
			m.set(mark.name, {
				apiId: mark.id,
				name: mark.name,
				date: mark.visited_on.slice(0, 10),
				description: mark.description
			});
		}
		return m;
	}

	// GeoJSON state
	let geojson = $state<GaliciaGeoJSON | null>(null);
	let loadError = $state(false);

	// Map render state
	let svgEl: SVGSVGElement;
	let paths: { feature: ConcelhoFeature; d: string }[] = $state([]);

	// Marks state — keyed by concello name (matches API)
	// Initialized from server-loaded data; updated optimistically on save/delete
	let marks = $state<Map<string, LocalMark>>(marksFromApi(data.marks ?? []));

	// Province filter
	const PROVINCES = ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra'];
	let activeProvince = $state<string | null>(null);

	// Derived counts — update when province filter changes
	let visibleFeatures = $derived(
		geojson
			? activeProvince
				? geojson.features.filter((f) => f.properties.province === activeProvince)
				: geojson.features
			: []
	);
	let visibleTotal = $derived(visibleFeatures.length);
	let visibleVisited = $derived(visibleFeatures.filter((f) => marks.has(f.properties.name)).length);

	// Modal state
	let modalOpen = $state(false);
	let selectedFeature: ConcelhoFeature | null = $state(null);
	let formDate = $state('');
	let formDescription = $state('');
	let saving = $state(false);

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
		selectedFeature = feature;
		const existing = marks.get(feature.properties.name);
		formDate = existing?.date ?? '';
		formDescription = existing?.description ?? '';
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
		selectedFeature = null;
	}

	async function saveModal() {
		if (!selectedFeature || !formDate) return;
		saving = true;
		const name = selectedFeature.properties.name;
		const existing = marks.get(name);
		try {
			if (existing) {
				const updated = await rutasApi.update(existing.apiId, {
					visited_on: formDate,
					description: formDescription
				});
				const newMark: LocalMark = {
					apiId: updated.id,
					name: updated.name,
					date: updated.visited_on.slice(0, 10),
					description: updated.description
				};
				marks = new Map(marks).set(name, newMark);
			} else {
				const created = await rutasApi.create({
					name,
					visited_on: formDate,
					description: formDescription
				});
				const newMark: LocalMark = {
					apiId: created.id,
					name: created.name,
					date: created.visited_on.slice(0, 10),
					description: created.description
				};
				marks = new Map(marks).set(name, newMark);
			}
		} catch (e) {
			addToast('Failed to save mark', 'error');
		} finally {
			saving = false;
		}
		closeModal();
	}

	async function removeMark() {
		if (!selectedFeature) return;
		const name = selectedFeature.properties.name;
		const existing = marks.get(name);
		if (!existing) { closeModal(); return; }
		saving = true;
		try {
			await rutasApi.delete(existing.apiId);
			const updated = new Map(marks);
			updated.delete(name);
			marks = updated;
		} catch (e) {
			addToast('Failed to remove mark', 'error');
		} finally {
			saving = false;
		}
		closeModal();
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
	<title>Rutas</title>
</svelte:head>

<div class="container rutas-page">
	<div class="rutas-header">
		<div class="rutas-title-row">
			<h1>Rutas</h1>
			<span class="rutas-counter">{visibleVisited}/{visibleTotal}</span>
		</div>
		<div class="rutas-filters">
			<button
				class="province-btn"
				class:active={activeProvince === null}
				onclick={() => (activeProvince = null)}
			>
				All
			</button>
			{#each PROVINCES as prov}
				<button
					class="province-btn"
					class:active={activeProvince === prov}
					onclick={() => (activeProvince = activeProvince === prov ? null : prov)}
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
		<svg bind:this={svgEl} class="rutas-map" width="100%" height="100%" aria-label="Mapa de concellos de Galicia">
			{#each paths as { feature, d }}
				{@const mark = marks.get(feature.properties.name)}
				{@const isVisible = !activeProvince || feature.properties.province === activeProvince}
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
	{#if marks.size > 0}
		<div class="rutas-visited">
			<p class="rutas-section-title">Visited ({marks.size})</p>
			<ul class="rutas-visited-list">
				{#each [...marks.values()].sort((a, b) => a.date.localeCompare(b.date)) as mark}
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
{#if modalOpen && selectedFeature}
	<div class="rutas-modal-wrapper">
		<button
			class="rutas-modal-backdrop"
			type="button"
			onclick={closeModal}
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
					<h3 class="rutas-modal-title" id="modal-title">{selectedFeature.properties.name}</h3>
					<p class="rutas-modal-province">{selectedFeature.properties.province}</p>
				</div>
				<button class="sheet-close" onclick={closeModal} aria-label="Close">✕</button>
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
				{#if marks.has(selectedFeature.properties.name)}
					<button class="btn-danger" type="button" onclick={removeMark} disabled={saving}>Remove</button>
				{/if}
				<button class="btn-secondary" type="button" onclick={closeModal}>Cancel</button>
				<button class="btn-primary" type="button" onclick={saveModal} disabled={!formDate || saving}>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
