<script lang="ts">
	import { getContext } from 'svelte';

	const { height, yScale, width } = getContext('LayerCake') as Record<string, any>;

	$: ticks = $yScale.ticks ? $yScale.ticks(5) : $yScale.domain();
</script>

<g class="axis y-axis">
	{#each ticks as tick}
		<g transform="translate(0, {$yScale(tick)})">
			<line x1="0" x2={$width} stroke="var(--color-text-muted)" opacity="0.1" />
			<text x="-8" text-anchor="end" dominant-baseline="middle" fill="var(--color-text-muted)" font-size="11">
				{tick}
			</text>
		</g>
	{/each}
</g>
