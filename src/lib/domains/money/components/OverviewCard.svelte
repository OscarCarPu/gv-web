<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import { formatMoney } from '$lib/shared/utils/money';
	import { formatDueDay, toLocalDateString } from '$lib/shared/utils/datetime';
	import TransactionRow from './TransactionRow.svelte';
	import TransactionFormSheet from './TransactionFormSheet.svelte';
	import NetWorthSheet from './NetWorthSheet.svelte';
	import CategoryBreakdownSheet from './CategoryBreakdownSheet.svelte';
	import MonthlyTrendSheet from './MonthlyTrendSheet.svelte';
	import EstimationSheet from './EstimationSheet.svelte';
	import type {
		Account,
		Category,
		Overview,
		Transaction,
	} from '$lib/domains/money/types/Money.types';

	interface Props {
		overview: Overview;
		accounts: Account[];
		categories: Category[];
	}

	let { overview, accounts, categories }: Props = $props();

	let netWorthOpen = $state(false);
	let categoryBreakdownOpen = $state(false);
	let monthlyTrendOpen = $state(false);
	let estimationOpen = $state(false);

	const FOLD_LIMIT = 15;
	const EXPAND_STEP = 10;
	let visibleCount = $state(FOLD_LIMIT);

	let visible = $derived(overview.recent_transactions.slice(0, visibleCount));
	let hasMore = $derived(visibleCount < overview.recent_transactions.length);
	let remaining = $derived(overview.recent_transactions.length - visibleCount);

	function showMore() {
		visibleCount = Math.min(visibleCount + EXPAND_STEP, overview.recent_transactions.length);
	}

	let sheetOpen = $state(false);
	let editingTx = $state<Transaction | null>(null);
	let loadingEdit = $state(false);

	let balanceNum = $derived(parseFloat(overview.month.balance));
	let balancePrefix = $derived(balanceNum > 0 ? '+' : balanceNum < 0 ? '−' : '');
	let balanceAbs = $derived(formatMoney(Math.abs(balanceNum).toFixed(2)));

	let incomeNum = $derived(parseFloat(overview.month.income));
	let savingsRate = $derived(incomeNum > 0 ? (balanceNum / incomeNum) * 100 : 0);

	let prevBalanceNum = $derived(parseFloat(overview.previous_month.balance));
	let balanceChangePct = $derived(
		prevBalanceNum !== 0 ? ((balanceNum - prevBalanceNum) / Math.abs(prevBalanceNum)) * 100 : 0
	);
	let hasPrevBalance = $derived(prevBalanceNum !== 0);

	const todayKey = toLocalDateString();

	function openCreate() {
		editingTx = null;
		sheetOpen = true;
	}

	async function openEdit(id: number) {
		if (loadingEdit) return;
		loadingEdit = true;
		try {
			const list = await moneyApi.listTransactions();
			const found = list.find((t) => t.id === id) ?? null;
			if (!found) {
				addToast('Transaction not found', 'error');
				return;
			}
			editingTx = found;
			sheetOpen = true;
		} catch {
			addToast('Error loading transaction', 'error');
		} finally {
			loadingEdit = false;
		}
	}

	async function onDelete(id: number) {
		try {
			await moneyApi.deleteTransaction(id);
			addNotification('Transaction deleted', 'success');
			await invalidateAll();
		} catch {
			addToast('Error deleting transaction', 'error');
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Summary</h2>
		<div class="section-actions">
			<button
				class="btn-icon"
				onclick={() => (netWorthOpen = true)}
				aria-label="Net worth evolution"
				title="Net worth evolution"
			>
				<Icon name="chart-line" />
			</button>
			<button
				class="btn-icon"
				onclick={() => (categoryBreakdownOpen = true)}
				aria-label="Expenses by category"
				title="Expenses by category"
			>
				<Icon name="chart-pie" />
			</button>
			<button
				class="btn-icon"
				onclick={() => (monthlyTrendOpen = true)}
				aria-label="Income vs expenses per month"
				title="Income vs expenses per month"
			>
				<Icon name="chart-column" />
			</button>
			<button
				class="btn-icon"
				onclick={() => (estimationOpen = true)}
				aria-label="Net worth estimation"
				title="Net worth estimation"
			>
				<Icon name="arrow-trend-up" />
			</button>
			<button class="btn-primary btn-sm" onclick={openCreate} disabled={accounts.length === 0}>
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
				class:amount-positive={balanceNum > 0}
				class:amount-negative={balanceNum < 0}
			>
				{balancePrefix}{balanceAbs}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Savings</span>
			<span
				class="detail-info-value"
				class:amount-positive={savingsRate > 0}
				class:amount-negative={savingsRate < 0}
			>
				{savingsRate.toFixed(1)}%
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">% vs prev month</span>
			{#if hasPrevBalance}
				<span
					class="detail-info-value"
					class:amount-positive={balanceChangePct > 0}
					class:amount-negative={balanceChangePct < 0}
				>
					{balanceChangePct >= 0 ? '+' : '−'}{Math.abs(balanceChangePct).toFixed(1)}%
				</span>
			{:else}
				<span class="detail-info-value amount-neutral">—</span>
			{/if}
		</div>
	</div>

	<h3 class="money-group-label">Recent transactions</h3>

	{#if overview.recent_transactions.length === 0}
		<div class="project-children-empty">No transactions in the last 30 days</div>
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
		{#if hasMore}
			<button class="show-more-btn" onclick={showMore}>
				<span class="show-more-line"></span>
				<span class="show-more-pill">
					<Icon name="chevron-down" />
					<span>{remaining} more</span>
				</span>
				<span class="show-more-line"></span>
			</button>
		{/if}
	{/if}
</section>

<TransactionFormSheet
	open={sheetOpen}
	onclose={() => (sheetOpen = false)}
	transaction={editingTx}
	{accounts}
	{categories}
/>

<NetWorthSheet open={netWorthOpen} onclose={() => (netWorthOpen = false)} />
<CategoryBreakdownSheet
	open={categoryBreakdownOpen}
	onclose={() => (categoryBreakdownOpen = false)}
	{categories}
	{accounts}
	onedittransaction={openEdit}
	ondeletetransaction={onDelete}
/>
<MonthlyTrendSheet open={monthlyTrendOpen} onclose={() => (monthlyTrendOpen = false)} {accounts} />
<EstimationSheet open={estimationOpen} onclose={() => (estimationOpen = false)} />
