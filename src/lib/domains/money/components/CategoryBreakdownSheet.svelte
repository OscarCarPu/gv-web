<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { formatMoney } from '$shared/utils/money';
	import TransactionRow from './TransactionRow.svelte';
	import type { Account, Category } from '../types/Money.types';
	import { CategoryBreakdown } from '../stats/categoryBreakdown.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		categories: Category[];
		accounts: Account[];
		onedittransaction?: (id: number) => void;
		ondeletetransaction?: (id: number) => void;
	}

	let { open, onclose, categories, accounts, onedittransaction, ondeletetransaction }: Props =
		$props();

	const ctrl = new CategoryBreakdown(
		() => categories,
		() => accounts
	);

	function monthLabel(ym: string): string {
		const [y, m] = ym.split('-').map(Number);
		const d = new Date(y, m - 1, 1);
		const s = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		return s.replace('.', '');
	}

	$effect(() => {
		if (open) {
			void ctrl.type;
			void ctrl.selectedMonth;
			void categories;
			untrack(() => {
				if (ctrl.selectedNode !== null) ctrl.back();
			});
			ctrl.loadStats();
		} else {
			ctrl.resetForClose();
		}
	});
</script>

<BottomSheet {open} {onclose}>
	{#if ctrl.selectedNode === null}
		<header class="cat-sheet-header">
			<h3 class="modal-title">By category</h3>
			<input
				id="cat-sheet-month"
				name="cat-sheet-month"
				class="cat-sheet-month"
				type="month"
				bind:value={ctrl.selectedMonth}
			/>
		</header>

		<div class="create-mode-toggle money-type-toggle cat-sheet-type">
			<button
				class="expense"
				class:active={ctrl.type === 'expense'}
				onclick={() => (ctrl.type = 'expense')}
			>
				Expenses
			</button>
			<button
				class="income"
				class:active={ctrl.type === 'income'}
				onclick={() => (ctrl.type = 'income')}
			>
				Income
			</button>
			<button
				class="transfer"
				class:active={ctrl.type === 'transfer'}
				onclick={() => (ctrl.type = 'transfer')}
			>
				Transfers
			</button>
		</div>

		<div class="cat-sheet-tiles">
			<div class="money-tile">
				<span class="detail-info-label">Total</span>
				<span class="detail-info-value {ctrl.amountClass}">
					{ctrl.sign}{formatMoney(ctrl.total.toFixed(2))}
				</span>
			</div>
			<div class="money-tile">
				<span class="detail-info-label">Transactions</span>
				<span class="detail-info-value">{ctrl.totalTx}</span>
			</div>
		</div>

		{#if ctrl.stats.initialLoading}
			<div class="history-loading">
				<div class="spinner"></div>
				Loading...
			</div>
		{:else if ctrl.tree.length === 0}
			<div class="history-empty">
				<Icon name="chart-pie" />
				<span>No categories of this type</span>
			</div>
		{:else}
			<ul
				class="cat-tree"
				class:cat-tree-income={ctrl.type === 'income'}
				class:cat-tree-transfer={ctrl.type === 'transfer'}
			>
				{#each ctrl.flatRows as row (row.node.category.id)}
					{@const n = row.node}
					{@const isExpanded = ctrl.expanded[n.category.id] === true}
					<li
						class="cat-tree-row"
						class:cat-tree-row-child={n.depth > 0}
						style="--cat-depth: {n.depth}"
					>
						<div class="cat-tree-head">
							{#if row.hasChildren}
								<button
									type="button"
									class="tree-chevron-btn"
									onclick={() => ctrl.toggle(n.category.id)}
									aria-label={isExpanded ? 'Collapse' : 'Expand'}
								>
									<Icon
										name="chevron-right"
										class={`tree-chevron${isExpanded ? ' expanded' : ''}`}
									/>
								</button>
							{:else}
								<span class="tree-chevron-spacer"></span>
							{/if}

							<button
								type="button"
								class="cat-tree-name-btn"
								onclick={() => ctrl.openCategory(n)}
								aria-label="View transactions for {n.category.name}"
							>
								<span class="cat-tree-name">{n.category.name}</span>
							</button>

							<span class="cat-tree-meta">
								<span class="cat-tree-count">
									{n.ownCount}{#if row.hasChildren}<span class="cat-tree-sub">/{n.totalCount}</span
										>{/if}
								</span>
								<span class="cat-tree-share">
									{row.ownSharePct.toFixed(1)}%{#if row.hasChildren}<span class="cat-tree-sub"
											>/{row.sharePct.toFixed(1)}%</span
										>{/if}
								</span>
								<span class="cat-tree-amount {ctrl.amountClass}">
									{ctrl.sign}{formatMoney(n.ownAmount.toFixed(2))}{#if row.hasChildren}<span
											class="cat-tree-sub">/{ctrl.sign}{formatMoney(n.totalAmount.toFixed(2))}</span
										>{/if}
								</span>
							</span>

							<button
								type="button"
								class="cat-tree-drill"
								onclick={() => ctrl.openCategory(n)}
								aria-label="View transactions"
							>
								<Icon name="chevron-right" />
							</button>
						</div>

						<div class="cat-tree-track">
							<div class="cat-tree-fill" style="width: {row.barPct}%"></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<header class="cat-detail-header">
			<button class="cat-detail-back" onclick={() => ctrl.back()} aria-label="Back to list">
				<Icon name="arrow-left" />
				<span>{ctrl.selectedNode.category.name}</span>
			</button>
			<span class="cat-detail-month">{monthLabel(ctrl.selectedMonth)}</span>
		</header>

		<div class="cat-sheet-tiles">
			<div class="money-tile">
				<span class="detail-info-label">Own total</span>
				<span class="detail-info-value {ctrl.amountClass}">
					{ctrl.sign}{formatMoney(ctrl.selectedNode.ownAmount.toFixed(2))}
				</span>
			</div>
			<div class="money-tile">
				<span class="detail-info-label">Transactions</span>
				<span class="detail-info-value">{ctrl.selectedNode.ownCount}</span>
			</div>
		</div>

		{#if ctrl.txLoading}
			<div class="history-loading">
				<div class="spinner"></div>
				Loading...
			</div>
		{:else if ctrl.detailRows.length === 0}
			<div class="history-empty">
				<Icon name="folder" />
				<span>No transactions this month</span>
			</div>
		{:else}
			<div class="task-list cat-detail-list">
				{#each ctrl.detailRows as tx (tx.id)}
					<TransactionRow
						{tx}
						onedit={(id) => onedittransaction?.(id)}
						ondelete={(id) => ondeletetransaction?.(id)}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</BottomSheet>
