<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { formatMoney } from '$shared/utils/money';
	import type { Account, MonthlyStat } from '../types/Money.types';
	import IncomeExpenseBars from './charts/IncomeExpenseBars.svelte';
	import { RangeSelector } from '../stats/rangeSelector.svelte';
	import { StatsResource } from '../stats/statsResource.svelte';
	import { isoDate } from '../utils/statsDate';

	interface Props {
		open: boolean;
		onclose: () => void;
		accounts: Account[];
	}

	let { open, onclose, accounts }: Props = $props();

	const selector = new RangeSelector('6m');
	let accountId = $state<number | null>(null);
	const resource = new StatsResource({
		fetcher: (p: { from?: string; to: string; account_id: number | null }) =>
			moneyApi.getMonthlyStats(p),
		empty: [] as MonthlyStat[],
	});

	$effect(() => {
		if (open) {
			const now = new Date();
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			resource.load({
				from: selector.from,
				to: isoDate(endOfMonth),
				account_id: accountId,
			});
		} else {
			resource.resetForClose();
		}
	});

	const data = $derived(resource.data);

	const totals = $derived.by(() => {
		let income = 0;
		let expense = 0;
		for (const m of data) {
			income += parseFloat(m.income);
			expense += parseFloat(m.expense);
		}
		const balance = income - expense;
		const savingsRate = income > 0 ? (balance / income) * 100 : 0;
		return { income, expense, balance, savingsRate };
	});

	const selectedAccountLabel = $derived(
		accountId == null ? 'All' : (accounts.find((a) => a.id === accountId)?.name ?? 'All')
	);

	let mirrorWidth = $state(0);
	const ARROW_PADDING_PX = 36;
	const selectStyle = $derived(`width: ${mirrorWidth + ARROW_PADDING_PX}px`);
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Income vs expenses per month</h3>

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

		<div class="sheet-account-filter">
			<label for="trend-account">Account</label>
			<div class="select-fit">
				<span class="select-fit-mirror" bind:clientWidth={mirrorWidth} aria-hidden="true">
					{selectedAccountLabel}
				</span>
				<select id="trend-account" bind:value={accountId} style={selectStyle}>
					<option value={null}>All</option>
					{#each accounts as a (a.id)}
						<option value={a.id}>{a.name}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Income</span>
			<span class="detail-info-value amount-positive">+{formatMoney(totals.income.toFixed(2))}</span
			>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Expenses</span>
			<span class="detail-info-value amount-negative"
				>−{formatMoney(totals.expense.toFixed(2))}</span
			>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Balance</span>
			<span
				class="detail-info-value"
				class:amount-positive={totals.balance > 0}
				class:amount-negative={totals.balance < 0}
			>
				{totals.balance >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.balance).toFixed(2))}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Savings</span>
			<span
				class="detail-info-value"
				class:amount-positive={totals.savingsRate > 0}
				class:amount-negative={totals.savingsRate < 0}
			>
				{totals.savingsRate.toFixed(1)}%
			</span>
		</div>
	</div>

	{#if resource.initialLoading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if data.length === 0}
		<div class="history-empty">
			<Icon name="chart-column" />
			<span>No data for this period</span>
		</div>
	{:else}
		<IncomeExpenseBars {data} />
	{/if}
</BottomSheet>
