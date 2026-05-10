<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import type { NetWorthPoint, StatsGranularity } from '../types/Money.types';
	import NetWorthChart from './charts/NetWorthChart.svelte';
	import { formatMoney } from '$shared/utils/money';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	type Range = '3m' | '6m' | '1y' | 'ytd' | 'all';
	let range = $state<Range>('6m');
	let data = $state<NetWorthPoint[]>([]);
	let initialLoading = $state(true);

	const granularity = $derived<StatsGranularity>(
		range === '3m' || range === '6m' ? 'week' : 'month'
	);

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function isoDate(d: Date): string {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	const dateRange = $derived.by((): { from?: string; to: string } => {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth();
		if (range === 'all') {
			return { to: isoDate(now) };
		}
		const start =
			range === '3m'
				? new Date(y, m - 2, 1)
				: range === '6m'
					? new Date(y, m - 5, 1)
					: range === '1y'
						? new Date(y, m - 11, 1)
						: new Date(y, 0, 1);
		return { from: isoDate(start), to: isoDate(now) };
	});

	async function fetchSeries() {
		try {
			data = await moneyApi.getNetWorthStats({
				from: dateRange.from,
				to: dateRange.to,
				granularity,
			});
		} catch {
			data = [];
		} finally {
			initialLoading = false;
		}
	}

	$effect(() => {
		if (open) {
			void range;
			fetchSeries();
		} else {
			initialLoading = true;
			data = [];
		}
	});

	const last = $derived(data.length > 0 ? parseFloat(data[data.length - 1].total) : 0);
	const first = $derived(data.length > 0 ? parseFloat(data[0].total) : 0);
	const delta = $derived(last - first);
	const deltaPct = $derived(first !== 0 ? (delta / first) * 100 : 0);
	const peak = $derived(data.length > 0 ? Math.max(...data.map((p) => parseFloat(p.total))) : 0);

	const ranges: Array<{ value: Range; label: string }> = [
		{ value: '3m', label: '3M' },
		{ value: '6m', label: '6M' },
		{ value: '1y', label: '1A' },
		{ value: 'ytd', label: 'YTD' },
		{ value: 'all', label: 'Todo' },
	];
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Evolución del patrimonio</h3>

	<div class="sheet-controls-row">
		<div class="create-mode-toggle sheet-range-toggle">
			{#each ranges as r (r.value)}
				<button type="button" class:active={range === r.value} onclick={() => (range = r.value)}>
					{r.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Actual</span>
			<span class="detail-info-value">{formatMoney(last.toFixed(2))}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Cambio</span>
			<span
				class="detail-info-value"
				class:amount-positive={delta > 0}
				class:amount-negative={delta < 0}
			>
				{delta >= 0 ? '+' : '−'}{formatMoney(Math.abs(delta).toFixed(2))}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">% Cambio</span>
			<span
				class="detail-info-value"
				class:amount-positive={delta > 0}
				class:amount-negative={delta < 0}
			>
				{delta >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Máximo</span>
			<span class="detail-info-value">{formatMoney(peak.toFixed(2))}</span>
		</div>
	</div>

	{#if initialLoading}
		<div class="history-loading">
			<div class="spinner"></div>
			Cargando...
		</div>
	{:else if data.length === 0}
		<div class="history-empty">
			<Icon name="chart-line" />
			<span>Sin datos para este período</span>
		</div>
	{:else}
		<NetWorthChart {data} {granularity} />
	{/if}
</BottomSheet>
