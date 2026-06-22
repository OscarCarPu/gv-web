<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatDueDay, toLocalDateString } from '$lib/shared/utils/datetime';
	import { MoneyOverview } from '$lib/domains/money/overview.svelte';
	import TransactionRow from './TransactionRow.svelte';
	import TransactionFormSheet from './TransactionFormSheet.svelte';
	import NetWorthSheet from './NetWorthSheet.svelte';
	import CategoryBreakdownSheet from './CategoryBreakdownSheet.svelte';
	import MonthlyTrendSheet from './MonthlyTrendSheet.svelte';
	import EstimationSheet from './EstimationSheet.svelte';
	import type { Account, Category, Overview } from '$lib/domains/money/types/Money.types';

	interface Props {
		overview: Overview;
		accounts: Account[];
		categories: Category[];
	}

	let { overview, accounts, categories }: Props = $props();

	const controller = new MoneyOverview(() => overview, {
		refresh: invalidateAll,
		getAccounts: () => accounts,
		getCategories: () => categories,
	});

	const openEdit = (id: number) => controller.openEdit(id);
	const onDelete = (id: number) => controller.deleteTransaction(id);

	const todayKey = toLocalDateString();

	let kpis = $derived(controller.kpis);
	let visible = $derived(controller.visible);
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Summary</h2>
		<div class="section-actions">
			<button
				class="btn-icon"
				onclick={() => controller.openSheet('netWorth')}
				aria-label="Net worth evolution"
				title="Net worth evolution"
			>
				<Icon name="chart-line" />
			</button>
			<button
				class="btn-icon"
				onclick={() => controller.openSheet('categoryBreakdown')}
				aria-label="Expenses by category"
				title="Expenses by category"
			>
				<Icon name="chart-pie" />
			</button>
			<button
				class="btn-icon"
				onclick={() => controller.openSheet('monthlyTrend')}
				aria-label="Income vs expenses per month"
				title="Income vs expenses per month"
			>
				<Icon name="chart-column" />
			</button>
			<button
				class="btn-icon"
				onclick={() => controller.openSheet('estimation')}
				aria-label="Net worth estimation"
				title="Net worth estimation"
			>
				<Icon name="arrow-trend-up" />
			</button>
			<button
				class="btn-primary btn-sm"
				onclick={() => controller.openCreate()}
				disabled={accounts.length === 0}
			>
				<Icon name="plus" /> Transaction
			</button>
		</div>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Total accounts</span>
			<span class="detail-info-value">
				{formatMoney(overview.accounts_total)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Monthly income</span>
			<span class="detail-info-value amount-positive">
				+{formatMoney(overview.month.income)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Monthly expenses</span>
			<span class="detail-info-value amount-negative">
				−{formatMoney(overview.month.expense)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Monthly balance</span>
			<span
				class="detail-info-value"
				class:amount-positive={kpis.balanceNum > 0}
				class:amount-negative={kpis.balanceNum < 0}
			>
				{kpis.balancePrefix}{kpis.balanceAbs}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Savings</span>
			<span
				class="detail-info-value"
				class:amount-positive={kpis.savingsRate > 0}
				class:amount-negative={kpis.savingsRate < 0}
			>
				{kpis.savingsRate.toFixed(1)}%
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">% vs prev month</span>
			{#if kpis.hasPrevBalance}
				<span
					class="detail-info-value"
					class:amount-positive={kpis.balanceChangePct > 0}
					class:amount-negative={kpis.balanceChangePct < 0}
				>
					{kpis.balanceChangePct >= 0 ? '+' : '−'}{Math.abs(kpis.balanceChangePct).toFixed(1)}%
				</span>
			{:else}
				<span class="detail-info-value amount-neutral">—</span>
			{/if}
		</div>
	</div>

	<div class="money-group-header">
		<h3 class="money-group-label">
			{controller.filtering ? 'Account history' : 'Recent transactions'}
		</h3>
		<select
			class="money-history-filter"
			aria-label="Filter transactions by account"
			value={controller.selectedAccountId === null ? '' : String(controller.selectedAccountId)}
			onchange={(e) => {
				const v = e.currentTarget.value;
				controller.selectAccount(v === '' ? null : Number(v));
			}}
		>
			<option value="">All accounts (recent)</option>
			{#each accounts as account (account.id)}
				<option value={String(account.id)}>{account.name}</option>
			{/each}
		</select>
	</div>

	{#if controller.loadingHistory && controller.source.length === 0}
		<div class="project-children-empty">Loading…</div>
	{:else if controller.source.length === 0}
		<div class="project-children-empty">
			{controller.filtering
				? 'No transactions for this account'
				: 'No transactions in the last 30 days'}
		</div>
	{:else}
		<div class="task-list">
			{#each visible as tx, i (tx.id)}
				{@const txKey = tx.occurred_at.slice(0, 10)}
				{@const prevKey = i > 0 ? visible[i - 1].occurred_at.slice(0, 10) : null}
				{@const isToday = txKey === todayKey}
				{#if i === 0 || txKey !== prevKey}
					<div class="agenda-day-divider" class:today={isToday}>
						<span class="agenda-day-line"></span>
						<span class="agenda-day-label">{formatDueDay(tx.occurred_at)}</span>
						<span class="agenda-day-line"></span>
					</div>
				{/if}
				<TransactionRow {tx} onedit={openEdit} ondelete={onDelete} />
			{/each}
		</div>
		{#if controller.hasMore}
			<button class="show-more-btn" onclick={() => controller.showMore()}>
				<span class="show-more-line"></span>
				<span class="show-more-pill">
					<Icon name="chevron-down" />
					<span>{controller.remaining} more</span>
				</span>
				<span class="show-more-line"></span>
			</button>
		{/if}
	{/if}
</section>

<TransactionFormSheet
	open={controller.sheetOpen}
	onclose={() => controller.closeForm()}
	transaction={controller.editingTx}
	{accounts}
	{categories}
/>

<NetWorthSheet open={controller.netWorthOpen} onclose={() => controller.closeSheet('netWorth')} />
<CategoryBreakdownSheet
	open={controller.categoryBreakdownOpen}
	onclose={() => controller.closeSheet('categoryBreakdown')}
	{categories}
	{accounts}
	onedittransaction={openEdit}
	ondeletetransaction={onDelete}
/>
<MonthlyTrendSheet
	open={controller.monthlyTrendOpen}
	onclose={() => controller.closeSheet('monthlyTrend')}
	{accounts}
/>
<EstimationSheet
	open={controller.estimationOpen}
	onclose={() => controller.closeSheet('estimation')}
/>
