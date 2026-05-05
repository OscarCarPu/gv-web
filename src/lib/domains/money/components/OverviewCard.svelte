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
				addToast('Movimiento no encontrado', 'error');
				return;
			}
			editingTx = found;
			sheetOpen = true;
		} catch {
			addToast('Error al cargar el movimiento', 'error');
		} finally {
			loadingEdit = false;
		}
	}

	async function onDelete(id: number) {
		try {
			await moneyApi.deleteTransaction(id);
			addNotification('Movimiento eliminado', 'success');
			await invalidateAll();
		} catch {
			addToast('Error al eliminar el movimiento', 'error');
		}
	}
</script>

<section class="tasks-section">
	<div class="section-header">
		<h2>Resumen</h2>
		<button class="btn-primary btn-sm" onclick={openCreate} disabled={accounts.length === 0}>
			<Icon name="plus" /> Movimiento
		</button>
	</div>

	<div class="money-tiles money-tiles-wrap">
		<div class="money-tile">
			<span class="detail-info-label">Total cuentas</span>
			<span class="detail-info-value">
				{formatMoney(overview.accounts_total)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Ingresos del mes</span>
			<span class="detail-info-value amount-positive">
				+{formatMoney(overview.month.income)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Gastos del mes</span>
			<span class="detail-info-value amount-negative">
				−{formatMoney(overview.month.expense)}
			</span>
		</div>
		<div class="money-tile">
			<span class="detail-info-label">Balance del mes</span>
			<span
				class="detail-info-value"
				class:amount-positive={balanceNum > 0}
				class:amount-negative={balanceNum < 0}
			>
				{balancePrefix}{balanceAbs}
			</span>
		</div>
	</div>

	<h3 class="money-group-label">Movimientos recientes</h3>

	{#if overview.recent_transactions.length === 0}
		<div class="project-children-empty">Sin movimientos en los últimos 30 días</div>
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
					<span>{remaining} más</span>
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
