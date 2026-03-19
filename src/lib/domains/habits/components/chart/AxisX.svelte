<script lang="ts">
	import { getContext } from 'svelte';

	const { width, height, xScale, custom } = getContext('LayerCake') as Record<string, any>;

	$: innerTicks = $xScale.ticks ? $xScale.ticks(5) : $xScale.domain();
	$: domain = $xScale.domain();
	$: ticks = mergeBoundary(innerTicks, domain);

	function mergeBoundary(inner: Date[], [start, end]: Date[]): Date[] {
		const minGap = ($xScale(end) - $xScale(start)) * 0.08;
		const result: Date[] = [];
		const startFar = inner.length === 0 || Math.abs($xScale(inner[0]) - $xScale(start)) > minGap;
		if (startFar) result.push(start);
		result.push(...inner);
		const endFar = inner.length === 0 || Math.abs($xScale(inner[inner.length - 1]) - $xScale(end)) > minGap;
		if (endFar) result.push(end);
		return result;
	}
	$: freq = $custom?.frequency ?? 'daily';

	const monthNames = [
		'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
		'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
	];

	function getISOWeek(d: Date): number {
		const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
		date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
		const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
		return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	}

	function formatTick(d: Date) {
		if (freq === 'weekly') {
			return `Sem. ${getISOWeek(d)}`;
		}
		if (freq === 'monthly') {
			return monthNames[d.getMonth()];
		}
		return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
	}
</script>

<g class="axis x-axis">
	{#each ticks as tick}
		{@const x = $xScale(tick)}
		<g transform="translate({x}, {$height})">
			<line y1="0" y2="5" stroke="var(--color-text-muted)" opacity="0.3" />
			<text
				y="18"
				text-anchor={x < 20 ? 'start' : x > $width - 20 ? 'end' : 'middle'}
				fill="var(--color-text-muted)"
				font-size="11"
			>
				{formatTick(tick)}
			</text>
		</g>
	{/each}
	<line x1="0" x2={$width} y1={$height} y2={$height} stroke="var(--color-text-muted)" opacity="0.2" />
</g>
