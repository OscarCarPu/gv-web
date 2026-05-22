<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { formatMoney } from '$shared/utils/money';
	import type { EstimationMode, EstimationPoint, EstimationResult } from '../types/Money.types';
	import EstimationChart from './charts/EstimationChart.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function monthKey(d: Date): string {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
	}

	function defaultStart(): string {
		const d = new Date();
		return monthKey(new Date(d.getFullYear(), d.getMonth() - 5, 1));
	}

	function defaultEnd(): string {
		const d = new Date();
		return monthKey(new Date(d.getFullYear() + 1, d.getMonth(), 1));
	}

	let startMonth = $state<string>(defaultStart());
	let endMonth = $state<string>(defaultEnd());
	let mode = $state<EstimationMode>('rate');
	let result = $state<EstimationResult | null>(null);
	let initialLoading = $state(true);
	let errorMsg = $state<string | null>(null);

	const rangeValid = $derived.by(() => {
		if (!startMonth || !endMonth) return false;
		return endMonth >= startMonth;
	});

	async function fetchData() {
		if (!rangeValid) {
			errorMsg = 'End month must be the same as or after start month';
			result = null;
			initialLoading = false;
			return;
		}
		errorMsg = null;
		try {
			result = await moneyApi.getEstimation({
				start_month: startMonth,
				end_month: endMonth,
				mode,
			});
		} catch {
			result = null;
		} finally {
			initialLoading = false;
		}
	}

	$effect(() => {
		if (open) {
			void startMonth;
			void endMonth;
			void mode;
			fetchData();
		} else {
			initialLoading = true;
			result = null;
		}
	});

	const data = $derived<EstimationPoint[]>(result?.points ?? []);
	const rateNum = $derived(result ? parseFloat(result.rate) : 0);
	const savingNum = $derived(result ? parseFloat(result.saving) : 0);

	const lastActual = $derived.by(() => {
		for (let i = data.length - 1; i >= 0; i--) {
			if (!data[i].estimated) return parseFloat(data[i].total);
		}
		return 0;
	});

	const lastEstimated = $derived(data.length > 0 ? parseFloat(data[data.length - 1].total) : 0);
	const delta = $derived(lastEstimated - lastActual);
	const deltaPct = $derived(lastActual !== 0 ? (delta / lastActual) * 100 : 0);
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Net worth estimation</h3>

	<div class="sheet-controls-row">
		<div class="create-mode-toggle sheet-range-toggle">
			<button type="button" class:active={mode === 'rate'} onclick={() => (mode = 'rate')}>
				Rate %/mo
			</button>
			<button type="button" class:active={mode === 'saving'} onclick={() => (mode = 'saving')}>
				Saving €/mo
			</button>
		</div>

		<div class="sheet-account-filter">
			<label for="est-start">Start</label>
			<input id="est-start" type="month" bind:value={startMonth} />
		</div>
		<div class="sheet-account-filter">
			<label for="est-end">End</label>
			<input id="est-end" type="month" bind:value={endMonth} />
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Current</span>
			<span class="detail-info-value">{formatMoney(lastActual.toFixed(2))}</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">{mode === 'rate' ? 'Monthly rate' : 'Monthly saving'}</span>
			<span
				class="detail-info-value"
				class:amount-positive={(mode === 'rate' ? rateNum : savingNum) > 0}
				class:amount-negative={(mode === 'rate' ? rateNum : savingNum) < 0}
			>
				{#if mode === 'rate'}
					{rateNum >= 0 ? '+' : '−'}{Math.abs(rateNum).toFixed(2)}%
				{:else}
					{savingNum >= 0 ? '+' : '−'}{formatMoney(Math.abs(savingNum).toFixed(2))}
				{/if}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Final estimate</span>
			<span class="detail-info-value">{formatMoney(lastEstimated.toFixed(2))}</span>
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
	</div>

	{#if errorMsg}
		<div class="history-empty">
			<Icon name="circle-exclamation" />
			<span>{errorMsg}</span>
		</div>
	{:else if initialLoading}
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
