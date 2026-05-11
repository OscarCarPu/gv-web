<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	type ChartPoint = { date: Date; value: number; estimated: boolean };

	type LCContext = {
		data: Readable<ChartPoint[]>;
		xScale: Readable<(d: Date) => number>;
		yScale: Readable<(v: number) => number>;
		height: Readable<number>;
	};

	interface Props {
		splitIndex: number;
	}

	let { splitIndex }: Props = $props();

	const { data, xScale, yScale, height } = getContext<LCContext>('LayerCake');

	function pathFrom(points: ChartPoint[]): string {
		if (points.length === 0) return '';
		return 'M' + points.map((p) => `${$xScale(p.date)},${$yScale(p.value)}`).join('L');
	}

	const actualPoints = $derived(splitIndex > 0 ? $data.slice(0, splitIndex) : []);
	// Bridge: include the last actual point so the dashed line connects.
	const projectedPoints = $derived.by(() => {
		if (splitIndex >= $data.length) return [];
		if (splitIndex === 0) return $data;
		return [$data[splitIndex - 1], ...$data.slice(splitIndex)];
	});

	const actualPath = $derived(pathFrom(actualPoints));
	const projectedPath = $derived(pathFrom(projectedPoints));

	const areaPath = $derived.by(() => {
		if ($data.length === 0) return '';
		const top = 'M' + $data.map((p) => `${$xScale(p.date)},${$yScale(p.value)}`).join('L');
		const last = $data[$data.length - 1];
		const first = $data[0];
		return top + `L${$xScale(last.date)},${$height}` + `L${$xScale(first.date)},${$height}Z`;
	});
</script>

<path d={areaPath} fill="var(--color-primary)" opacity="0.08" />

{#if actualPath}
	<path
		d={actualPath}
		fill="none"
		stroke="var(--color-primary)"
		stroke-width="2"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
{/if}

{#if projectedPath}
	<path
		d={projectedPath}
		fill="none"
		stroke="var(--color-primary)"
		stroke-width="2"
		stroke-dasharray="5 4"
		stroke-linejoin="round"
		stroke-linecap="round"
		opacity="0.85"
	/>
{/if}
