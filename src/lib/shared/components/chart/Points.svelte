<script lang="ts">
	import { getContext } from 'svelte';

	const { data, xGet, yGet, custom } = getContext('LayerCake') as Record<string, any>;

	let hoveredIndex: number | null = $state(null);

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

	function formatDate(d: Date, freq: string): string {
		if (freq === 'monthly') return monthNames[d.getMonth()];
		if (freq === 'weekly') return `Sem. ${getISOWeek(d)}`;
		return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
	}
</script>

<g class="points">
	{#each $data as point, i}
		{@const cx = $xGet(point)}
		{@const cy = $yGet(point)}
		{@const isHovered = hoveredIndex === i}
		<!-- Invisible hit area -->
		<circle
			{cx}
			{cy}
			r="20"
			fill="transparent"
			style="cursor: pointer;"
			onpointerenter={() => hoveredIndex = i}
			onpointerleave={() => hoveredIndex = null}
		/>
		<!-- Visible point -->
		<circle
			{cx}
			{cy}
			r={isHovered ? 5 : 3}
			fill="var(--color-primary)"
			style="pointer-events: none; transition: r 0.15s ease;"
		/>
		{#if isHovered}
			{@const fmt = $custom?.formatValue ?? ((v) => String(v))}
			{@const label = `${fmt(point.value)} · ${formatDate(point.date, $custom?.frequency ?? 'daily')}`}
			{@const textWidth = label.length * 6.5 + 16}
			<g transform="translate({cx}, {cy - 16})" style="pointer-events: none;">
				<rect
					x={-textWidth / 2}
					y="-24"
					width={textWidth}
					height="22"
					rx="4"
					fill="var(--color-bg)"
					stroke="var(--color-text-muted)"
					stroke-opacity="0.3"
				/>
				<text
					text-anchor="middle"
					y="-9"
					fill="var(--color-text)"
					font-size="11"
					font-weight="500"
				>{label}</text>
			</g>
		{/if}
	{/each}
</g>
