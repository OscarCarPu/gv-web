<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	type Point = { date: Date; value: number };

	type LCContext = {
		data: Readable<Point[]>;
		xScale: Readable<(d: Date) => number>;
		yScale: Readable<(v: number) => number>;
		width: Readable<number>;
		height: Readable<number>;
	};

	export type HoverInfo = {
		index: number;
		x: number;
		y: number;
		point: Point;
		chartWidth: number;
	};

	interface Props {
		onhover: (info: HoverInfo | null) => void;
		hoveredIndex: number | null;
	}

	let { onhover, hoveredIndex }: Props = $props();

	const { data, xScale, yScale, width, height } = getContext<LCContext>('LayerCake');

	function emitFromMouse(mouseX: number) {
		if ($data.length === 0) {
			onhover(null);
			return;
		}
		let closest = 0;
		let bestDist = Infinity;
		for (let i = 0; i < $data.length; i++) {
			const px = $xScale($data[i].date);
			const dist = Math.abs(px - mouseX);
			if (dist < bestDist) {
				bestDist = dist;
				closest = i;
			}
		}
		const point = $data[closest];
		onhover({
			index: closest,
			x: $xScale(point.date),
			y: $yScale(point.value),
			point,
			chartWidth: $width,
		});
	}

	function handleMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		emitFromMouse(e.clientX - rect.left);
	}

	function handleLeave() {
		onhover(null);
	}

	const markerX = $derived(
		hoveredIndex != null && $data[hoveredIndex] ? $xScale($data[hoveredIndex].date) : null
	);
	const markerY = $derived(
		hoveredIndex != null && $data[hoveredIndex] ? $yScale($data[hoveredIndex].value) : null
	);
</script>

{#if markerX != null && markerY != null}
	<line
		x1={markerX}
		x2={markerX}
		y1={0}
		y2={$height}
		stroke="var(--color-text-muted)"
		stroke-dasharray="3 3"
		opacity="0.4"
	/>
	<circle
		cx={markerX}
		cy={markerY}
		r="5"
		fill="var(--color-primary)"
		stroke="var(--color-bg)"
		stroke-width="2"
	/>
{/if}

<rect
	x="0"
	y="0"
	width={$width}
	height={$height}
	fill="transparent"
	onmousemove={handleMove}
	onmouseleave={handleLeave}
	role="presentation"
/>
