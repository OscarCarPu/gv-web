<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	type LayerCakeContext = {
		yScale: Readable<{
			ticks?: (count: number) => number[];
			domain: () => number[];
			(value: number): number;
		}>;
		width: Readable<number>;
		custom: Readable<{ formatTick?: (v: number) => string } | undefined>;
	};

	const { yScale, width, custom } = getContext<LayerCakeContext>('LayerCake');

	function shortMoney(v: number): string {
		const abs = Math.abs(v);
		if (abs >= 1000) {
			const k = v / 1000;
			const decimals = abs >= 10000 ? 0 : 1;
			return `${k.toFixed(decimals)}k €`;
		}
		return `${Math.round(v)} €`;
	}
</script>

<g class="axis y-axis">
	{#each $yScale.ticks ? $yScale.ticks(5) : $yScale.domain() as tick (tick)}
		<g transform="translate(0, {$yScale(tick)})">
			<line x1="0" x2={$width} stroke="var(--color-text-muted)" opacity="0.1" />
			<text
				x="-8"
				text-anchor="end"
				dominant-baseline="middle"
				fill="var(--color-text-muted)"
				font-size="11"
			>
				{$custom?.formatTick ? $custom.formatTick(tick) : shortMoney(tick)}
			</text>
		</g>
	{/each}
</g>
