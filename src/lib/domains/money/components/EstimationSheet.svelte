<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { formatMoney } from '$shared/utils/money';
	import EstimationChart from './charts/EstimationChart.svelte';
	import { Estimation } from '../stats/estimation.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const est = new Estimation();

	$effect(() => {
		if (open) {
			void est.startMonth;
			void est.endMonth;
			void est.mode;
			est.load();
		} else {
			est.resetForClose();
		}
	});

	const data = $derived(est.data);
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Net worth estimation</h3>

	<div class="sheet-controls-row">
		<div class="create-mode-toggle sheet-range-toggle">
			<button type="button" class:active={est.mode === 'rate'} onclick={() => (est.mode = 'rate')}>
				Rate %/mo
			</button>
			<button
				type="button"
				class:active={est.mode === 'saving'}
				onclick={() => (est.mode = 'saving')}
			>
				Saving €/mo
			</button>
		</div>

		<div class="sheet-account-filter">
			<label for="est-start">Start</label>
			<input id="est-start" type="month" bind:value={est.startMonth} />
		</div>
		<div class="sheet-account-filter">
			<label for="est-end">End</label>
			<input id="est-end" type="month" bind:value={est.endMonth} />
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Current</span>
			<span class="detail-info-value">{formatMoney(est.lastActual.toFixed(2))}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label"
				>{est.mode === 'rate' ? 'Monthly rate' : 'Monthly saving'}</span
			>
			<span
				class="detail-info-value"
				class:amount-positive={(est.mode === 'rate' ? est.rateNum : est.savingNum) > 0}
				class:amount-negative={(est.mode === 'rate' ? est.rateNum : est.savingNum) < 0}
			>
				{#if est.mode === 'rate'}
					{est.rateNum >= 0 ? '+' : '−'}{Math.abs(est.rateNum).toFixed(2)}%
				{:else}
					{est.savingNum >= 0 ? '+' : '−'}{formatMoney(Math.abs(est.savingNum).toFixed(2))}
				{/if}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Final estimate</span>
			<span class="detail-info-value">{formatMoney(est.lastEstimated.toFixed(2))}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">% Change</span>
			<span
				class="detail-info-value"
				class:amount-positive={est.delta > 0}
				class:amount-negative={est.delta < 0}
			>
				{est.delta >= 0 ? '+' : '−'}{Math.abs(est.deltaPct).toFixed(1)}%
			</span>
		</div>
	</div>

	{#if est.errorMsg}
		<div class="history-empty">
			<Icon name="circle-exclamation" />
			<span>{est.errorMsg}</span>
		</div>
	{:else if est.initialLoading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if data.length === 0}
		<div class="history-empty">
			<Icon name="arrow-trend-up" />
			<span>No data for this period</span>
		</div>
	{:else}
		<EstimationChart {data} />
	{/if}
</BottomSheet>
