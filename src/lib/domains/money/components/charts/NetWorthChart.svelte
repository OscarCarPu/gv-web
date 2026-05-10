<script lang="ts">
	import { scaleTime } from 'd3-scale';
	import { LayerCake, Svg } from 'layercake';

	import Line from '$shared/components/chart/Line.svelte';
	import Area from '$shared/components/chart/Area.svelte';
	import AxisX from '$shared/components/chart/AxisX.svelte';
	import Points from '$shared/components/chart/Points.svelte';
	import AxisYMoney from './AxisYMoney.svelte';
	import NetWorthHoverLayer, { type HoverInfo } from './NetWorthHoverLayer.svelte';
	import { formatMoney } from '$shared/utils/money';
	import type { NetWorthPoint, StatsGranularity } from '../../types/Money.types';

	interface Props {
		data: NetWorthPoint[];
		granularity?: StatsGranularity;
		showPoints?: boolean;
	}

	let { data, granularity = 'day', showPoints = false }: Props = $props();

	const padding = { top: 10, right: 15, bottom: 30, left: 60 };

	const chartData = $derived(
		data.map((d) => ({
			date: new Date(d.date + 'T00:00:00'),
			value: parseFloat(d.total),
		}))
	);

	const yDomain = $derived.by((): [number, number] => {
		if (chartData.length === 0) return [0, 1];
		const values = chartData.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || max || 1;
		const margin = range * 0.1;
		return [Math.max(0, min - margin), max + margin];
	});

	const xFrequency = $derived(
		granularity === 'day' ? 'daily' : granularity === 'week' ? 'weekly' : 'monthly'
	);

	function formatValue(v: number): string {
		return formatMoney(v.toFixed(2));
	}

	const monthNames = [
		'Ene',
		'Feb',
		'Mar',
		'Abr',
		'May',
		'Jun',
		'Jul',
		'Ago',
		'Sep',
		'Oct',
		'Nov',
		'Dic',
	];

	function formatTooltipDate(d: Date): string {
		if (granularity === 'month') {
			return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
		}
		return d.toLocaleDateString('es-ES', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	}

	let hover = $state<HoverInfo | null>(null);

	const tooltipLeft = $derived.by(() => {
		if (!hover) return 0;
		const x = padding.left + hover.x;
		const tooltipWidth = 180;
		const containerEdge = padding.left + hover.chartWidth;
		if (x + tooltipWidth + 12 > containerEdge + padding.right) {
			return x - tooltipWidth - 12;
		}
		return x + 12;
	});

	const tooltipTop = $derived(hover ? padding.top + hover.y - 8 : 0);
</script>

{#if chartData.length === 0}
	<div class="chart-empty">Sin datos en este período</div>
{:else}
	<div class="chart-container nw-chart">
		<LayerCake
			data={chartData}
			x="date"
			y="value"
			xScale={scaleTime()}
			{yDomain}
			{padding}
			custom={{ frequency: xFrequency, formatValue }}
		>
			<Svg>
				<AxisYMoney />
				<AxisX />
				<Area />
				<Line />
				{#if showPoints}
					<Points />
				{/if}
				<NetWorthHoverLayer
					hoveredIndex={hover ? hover.index : null}
					onhover={(info) => (hover = info)}
				/>
			</Svg>
		</LayerCake>

		{#if hover}
			<div class="nw-tooltip" style="left: {tooltipLeft}px; top: {tooltipTop}px">
				<div class="nw-tooltip-date">{formatTooltipDate(hover.point.date)}</div>
				<div class="nw-tooltip-value">{formatMoney(hover.point.value.toFixed(2))}</div>
			</div>
		{/if}
	</div>
{/if}
