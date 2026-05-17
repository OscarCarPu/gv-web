<script lang="ts">
	import { untrack } from 'svelte';
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { formatMoney } from '$shared/utils/money';
	import TransactionRow from './TransactionRow.svelte';
	import type {
		Account,
		Category,
		CategoryStat,
		OverviewTransaction,
		Transaction,
	} from '../types/Money.types';

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

	let type = $state<'expense' | 'income' | 'transfer'>('expense');
	let stats = $state<CategoryStat[]>([]);
	let initialLoading = $state(true);

	function currentMonth(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	}

	let selectedMonth = $state(currentMonth());

	function monthBounds(ym: string): { from: string; to: string } {
		const [y, m] = ym.split('-').map(Number);
		const last = new Date(y, m, 0).getDate();
		const mm = String(m).padStart(2, '0');
		return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
	}

	function monthLabel(ym: string): string {
		const [y, m] = ym.split('-').map(Number);
		const d = new Date(y, m - 1, 1);
		const s = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
		return s.replace('.', '');
	}

	async function fetchStats() {
		try {
			const { from, to } = monthBounds(selectedMonth);
			stats = await moneyApi.getCategoryStats({ type, from, to });
		} catch {
			stats = [];
		} finally {
			initialLoading = false;
		}
	}

	type Node = {
		category: Category;
		ownAmount: number;
		ownCount: number;
		descendantAmount: number;
		descendantCount: number;
		totalAmount: number;
		totalCount: number;
		depth: number;
		children: Node[];
	};

	let selectedNode = $state<Node | null>(null);
	let categoryTx = $state<Transaction[]>([]);
	let txLoading = $state(false);

	async function openCategory(node: Node) {
		selectedNode = node;
		txLoading = true;
		categoryTx = [];
		try {
			const { from, to } = monthBounds(selectedMonth);
			categoryTx = await moneyApi.listTransactions({
				categoryId: node.category.id,
				type,
				from,
				to,
			});
		} catch {
			categoryTx = [];
		} finally {
			txLoading = false;
		}
	}

	function back() {
		selectedNode = null;
		categoryTx = [];
	}

	$effect(() => {
		if (open) {
			void type;
			void selectedMonth;
			void categories;
			untrack(() => {
				if (selectedNode !== null) back();
			});
			fetchStats();
		} else {
			initialLoading = true;
			stats = [];
			selectedMonth = currentMonth();
			selectedNode = null;
			categoryTx = [];
		}
	});

	const tree = $derived.by((): Node[] => {
		const filtered = categories.filter((c) => c.type === type);
		if (filtered.length === 0) return [];

		const amountById: Record<number, number> = {};
		const countById: Record<number, number> = {};
		for (const s of stats) {
			if (s.category_id != null) {
				amountById[s.category_id] = parseFloat(s.amount);
				countById[s.category_id] = s.tx_count;
			}
		}

		const ids: Record<number, true> = {};
		for (const c of filtered) ids[c.id] = true;

		const byParent: Record<number, Category[]> = {};
		const roots: Category[] = [];
		for (const c of filtered) {
			if (c.parent_id != null && ids[c.parent_id]) {
				if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
				byParent[c.parent_id].push(c);
			} else {
				roots.push(c);
			}
		}
		const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
		roots.sort(byName);
		for (const arr of Object.values(byParent)) arr.sort(byName);

		function build(c: Category, depth: number): Node {
			const own = amountById[c.id] ?? 0;
			const ownCount = countById[c.id] ?? 0;
			const kids = (byParent[c.id] ?? []).map((k) => build(k, depth + 1));
			const descAmount = kids.reduce((s, k) => s + k.totalAmount, 0);
			const descCount = kids.reduce((s, k) => s + k.totalCount, 0);
			return {
				category: c,
				ownAmount: own,
				ownCount,
				descendantAmount: descAmount,
				descendantCount: descCount,
				totalAmount: own + descAmount,
				totalCount: ownCount + descCount,
				depth,
				children: kids,
			};
		}

		const built = roots.map((r) => build(r, 0));
		built.sort((a, b) => b.totalAmount - a.totalAmount);
		return built;
	});

	const total = $derived(tree.reduce((s, n) => s + n.totalAmount, 0));
	const totalTx = $derived(tree.reduce((s, n) => s + n.totalCount, 0));
	const rootMax = $derived(Math.max(0.01, ...tree.map((n) => n.totalAmount)));

	let expanded = $state<Record<number, true>>({});
	function toggle(id: number) {
		const next: Record<number, true> = { ...expanded };
		if (next[id]) delete next[id];
		else next[id] = true;
		expanded = next;
	}

	type FlatRow = {
		node: Node;
		hasChildren: boolean;
		barPct: number;
		sharePct: number;
		ownSharePct: number;
	};

	const flatRows = $derived.by((): FlatRow[] => {
		const out: FlatRow[] = [];
		function walk(node: Node) {
			const barPct = rootMax > 0 ? (node.totalAmount / rootMax) * 100 : 0;
			const sharePct = total > 0 ? (node.totalAmount / total) * 100 : 0;
			const ownSharePct = total > 0 ? (node.ownAmount / total) * 100 : 0;
			const hasChildren = node.children.length > 0;
			out.push({ node, hasChildren, barPct, sharePct, ownSharePct });
			if (hasChildren && expanded[node.category.id]) {
				for (const k of node.children) walk(k);
			}
		}
		for (const r of tree) walk(r);
		return out;
	});

	const sign = $derived(type === 'income' ? '+' : type === 'expense' ? '−' : '');
	const amountClass = $derived(
		type === 'income'
			? 'amount-positive'
			: type === 'expense'
				? 'amount-negative'
				: 'amount-neutral'
	);

	const accountById = $derived(Object.fromEntries(accounts.map((a) => [a.id, a.name])));
	const categoryById = $derived(Object.fromEntries(categories.map((c) => [c.id, c.name])));

	const detailRows = $derived<OverviewTransaction[]>(
		categoryTx.map((tx) => ({
			id: tx.id,
			type: tx.type,
			amount: tx.amount,
			account_name: accountById[tx.account_id] ?? '',
			to_account_name: tx.to_account_id != null ? (accountById[tx.to_account_id] ?? null) : null,
			category_name: tx.category_id != null ? (categoryById[tx.category_id] ?? null) : null,
			description: tx.description,
			occurred_at: tx.occurred_at,
		}))
	);
</script>

<BottomSheet {open} {onclose}>
	{#if selectedNode === null}
		<header class="cat-sheet-header">
			<h3 class="modal-title">Por categoría</h3>
			<input
				id="cat-sheet-month"
				name="cat-sheet-month"
				class="cat-sheet-month"
				type="month"
				bind:value={selectedMonth}
			/>
		</header>

		<div class="create-mode-toggle money-type-toggle cat-sheet-type">
			<button class="expense" class:active={type === 'expense'} onclick={() => (type = 'expense')}>
				Gastos
			</button>
			<button class="income" class:active={type === 'income'} onclick={() => (type = 'income')}>
				Ingresos
			</button>
			<button
				class="transfer"
				class:active={type === 'transfer'}
				onclick={() => (type = 'transfer')}
			>
				Transferencias
			</button>
		</div>

		<div class="cat-sheet-tiles">
			<div class="money-tile">
				<span class="detail-info-label">Total</span>
				<span class="detail-info-value {amountClass}">
					{sign}{formatMoney(total.toFixed(2))}
				</span>
			</div>
			<div class="money-tile">
				<span class="detail-info-label">Movimientos</span>
				<span class="detail-info-value">{totalTx}</span>
			</div>
		</div>

		{#if initialLoading}
			<div class="history-loading">
				<div class="spinner"></div>
				Cargando...
			</div>
		{:else if tree.length === 0}
			<div class="history-empty">
				<Icon name="chart-pie" />
				<span>Sin categorías de este tipo</span>
			</div>
		{:else}
			<ul
				class="cat-tree"
				class:cat-tree-income={type === 'income'}
				class:cat-tree-transfer={type === 'transfer'}
			>
				{#each flatRows as row (row.node.category.id)}
					{@const n = row.node}
					{@const isExpanded = expanded[n.category.id] === true}
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
									onclick={() => toggle(n.category.id)}
									aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
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
								onclick={() => openCategory(n)}
								aria-label="Ver movimientos de {n.category.name}"
							>
								<span class="cat-tree-name">{n.category.name}</span>
							</button>

							<span class="cat-tree-meta">
								<span class="cat-tree-count">
									{n.ownCount}{#if row.hasChildren}<span class="cat-tree-sub">/{n.totalCount}</span>{/if}
								</span>
								<span class="cat-tree-share">
									{row.ownSharePct.toFixed(1)}%{#if row.hasChildren}<span class="cat-tree-sub">/{row.sharePct.toFixed(1)}%</span>{/if}
								</span>
								<span class="cat-tree-amount {amountClass}">
									{sign}{formatMoney(n.ownAmount.toFixed(2))}{#if row.hasChildren}<span class="cat-tree-sub">/{sign}{formatMoney(n.totalAmount.toFixed(2))}</span>{/if}
								</span>
							</span>

							<button
								type="button"
								class="cat-tree-drill"
								onclick={() => openCategory(n)}
								aria-label="Ver movimientos"
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
			<button class="cat-detail-back" onclick={back} aria-label="Volver al árbol">
				<Icon name="arrow-left" />
				<span>{selectedNode.category.name}</span>
			</button>
			<span class="cat-detail-month">{monthLabel(selectedMonth)}</span>
		</header>

		<div class="cat-sheet-tiles">
			<div class="money-tile">
				<span class="detail-info-label">Total propio</span>
				<span class="detail-info-value {amountClass}">
					{sign}{formatMoney(selectedNode.ownAmount.toFixed(2))}
				</span>
			</div>
			<div class="money-tile">
				<span class="detail-info-label">Movimientos</span>
				<span class="detail-info-value">{selectedNode.ownCount}</span>
			</div>
		</div>

		{#if txLoading}
			<div class="history-loading">
				<div class="spinner"></div>
				Cargando...
			</div>
		{:else if detailRows.length === 0}
			<div class="history-empty">
				<Icon name="folder" />
				<span>Sin movimientos este mes</span>
			</div>
		{:else}
			<div class="task-list cat-detail-list">
				{#each detailRows as tx (tx.id)}
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
