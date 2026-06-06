<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import type { NetWorthPoint, StatsGranularity } from '../types/Money.types';
	import NetWorthChart from './charts/NetWorthChart.svelte';
	import { formatMoney } from '$shared/utils/money';
	import { RangeSelector } from '../stats/rangeSelector.svelte';
	import { StatsResource } from '../stats/statsResource.svelte';
	import { isoDate } from '../utils/statsDate';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const selector = new RangeSelector('6m');
	const resource = new StatsResource({
		fetcher: (p: { from?: string; to: string; granularity: StatsGranularity }) =>
			moneyApi.getNetWorthStats(p),
		empty: [] as NetWorthPoint[],
	});

	$effect(() => {
		if (open) {
			resource.load({
				from: selector.from,
				to: isoDate(new Date()),
				granularity: selector.granularity,
			});
		} else {
			resource.resetForClose();
		}
	});

	const data = $derived(resource.data);
	const granularity = $derived(selector.granularity);

	const last = $derived(data.length > 0 ? parseFloat(data[data.length - 1].total) : 0);
	const first = $derived(data.length > 0 ? parseFloat(data[0].total) : 0);
	const delta = $derived(last - first);
	const deltaPct = $derived(first !== 0 ? (delta / first) * 100 : 0);
	const peak = $derived(data.length > 0 ? Math.max(...data.map((p) => parseFloat(p.total))) : 0);
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Net worth evolution</h3>

	<div class="sheet-controls-row">
		<div class="create-mode-toggle sheet-range-toggle">
			{#each selector.ranges as r (r.value)}
				<button
					type="button"
					class:active={selector.range === r.value}
					onclick={() => (selector.range = r.value)}
				>
					{r.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Current</span>
			<span class="detail-info-value">{formatMoney(last.toFixed(2))}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Change</span>
			<span
				class="detail-info-value"
				class:amount-positive={delta > 0}
				class:amount-negative={delta < 0}
			>
				{delta >= 0 ? '+' : '−'}{formatMoney(Math.abs(delta).toFixed(2))}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">% Change</span>
			<span
				class="detail-info-value"
				class:amount-positive={delta > 0}
				class:amount-negative={delta < 0}
			>
				{delta >= 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Maximum</span>
			<span class="detail-info-value">{formatMoney(peak.toFixed(2))}</span>
		</div>
	</div>

	{#if resource.initialLoading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if data.length === 0}
		<div class="history-empty">
			<Icon name="chart-line" />
			<span>No data for this period</span>
		</div>
	{:else}
		<NetWorthChart {data} {granularity} />
	{/if}
</BottomSheet>
