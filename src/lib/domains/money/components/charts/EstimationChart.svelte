<script lang="ts">
	import { scaleTime } from 'd3-scale';
	import { LayerCake, Svg } from 'layercake';

	import AxisX from '$shared/components/chart/AxisX.svelte';
	import AxisYMoney from './AxisYMoney.svelte';
	import EstimationPaths from './EstimationPaths.svelte';
	import NetWorthHoverLayer, { type HoverInfo } from './NetWorthHoverLayer.svelte';
	import { formatMoney } from '$shared/utils/money';
	import type { EstimationPoint } from '../../types/Money.types';

	interface Props {
		data: EstimationPoint[];
	}

	let { data }: Props = $props();

	const padding = { top: 10, right: 15, bottom: 30, left: 60 };

	type ChartPoint = { date: Date; value: number; estimated: boolean };

	const chartData = $derived<ChartPoint[]>(
		data.map((d) => ({
			date: new Date(d.date + 'T00:00:00'),
			value: parseFloat(d.total),
			estimated: d.estimated,
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

	const splitIndex = $derived.by(() => {
		const i = chartData.findIndex((p) => p.estimated);
		return i === -1 ? chartData.length : i;
	});

	function formatValue(v: number): string {
		return formatMoney(v.toFixed(2));
	}

	const monthNames = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];

	function formatTooltipDate(d: Date): string {
		return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
	}

	let hover = $state<HoverInfo | null>(null);

	const hoverPct = $derived.by(() => {
		if (!hover || chartData.length === 0) return null;
		const start = chartData[0].value;
		if (start === 0) return null;
		return ((hover.point.value - start) / start) * 100;
	});

	const hoverIsEstimated = $derived.by(() => {
		if (!hover) return false;
		return chartData[hover.index]?.estimated ?? false;
	});

	const tooltipLeft = $derived.by(() => {
		if (!hover) return 0;
		const x = padding.left + hover.x;
		const tooltipWidth = 200;
		const containerEdge = padding.left + hover.chartWidth;
		if (x + tooltipWidth + 12 > containerEdge + padding.right) {
			return x - tooltipWidth - 12;
		}
		return x + 12;
	});

	const tooltipTop = $derived(hover ? padding.top + hover.y - 8 : 0);
</script>

{#if chartData.length === 0}
	<div class="chart-empty">No data for this period</div>
{:else}
	<div class="chart-container nw-chart">
		<LayerCake
			data={chartData}
			x="date"
			y="value"
			xScale={scaleTime()}
			{yDomain}
			{padding}
			custom={{ frequency: 'monthly', formatValue }}
		>
			<Svg>
				<AxisYMoney />
				<AxisX />
				<EstimationPaths {splitIndex} />
				<NetWorthHoverLayer
					hoveredIndex={hover ? hover.index : null}
					onhover={(info) => (hover = info)}
				/>
			</Svg>
		</LayerCake>

		{#if hover}
			<div class="nw-tooltip" style="left: {tooltipLeft}px; top: {tooltipTop}px">
				<div class="nw-tooltip-date">
					{formatTooltipDate(hover.point.date)}
					{#if hoverIsEstimated}<span class="est-badge">estimado</span>{/if}
				</div>
				<div class="nw-tooltip-value">{formatMoney(hover.point.value.toFixed(2))}</div>
				{#if hoverPct !== null}
					<div
						class="nw-tooltip-pct"
						class:amount-positive={hoverPct > 0}
						class:amount-negative={hoverPct < 0}
					>
						{hoverPct >= 0 ? '+' : '−'}{Math.abs(hoverPct).toFixed(1)}%
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
