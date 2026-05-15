<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { moneyApi } from '$lib/domains/money/api/money.api';
	import { formatMoney } from '$shared/utils/money';
	import type { Category, CategoryStat } from '../types/Money.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		categories: Category[];
	}

	let { open, onclose, categories }: Props = $props();

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

	$effect(() => {
		if (open) {
			void type;
			void selectedMonth;
			void categories;
			fetchStats();
		} else {
			initialLoading = true;
			stats = [];
			selectedMonth = currentMonth();
		}
	});

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
	};

	const flatRows = $derived.by((): FlatRow[] => {
		const out: FlatRow[] = [];
		function walk(node: Node) {
			const barPct = rootMax > 0 ? (node.totalAmount / rootMax) * 100 : 0;
			const sharePct = total > 0 ? (node.totalAmount / total) * 100 : 0;
			const hasChildren = node.children.length > 0;
			out.push({ node, hasChildren, barPct, sharePct });
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
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Por categoría</h3>

	<div class="sheet-controls-row cat-breakdown-month-row">
		<div class="sheet-account-filter">
			<label for="cat-month">Mes</label>
			<input id="cat-month" type="month" bind:value={selectedMonth} />
		</div>
	</div>

	<div class="create-mode-toggle money-type-toggle cat-breakdown-toggle">
		<button class="expense" class:active={type === 'expense'} onclick={() => (type = 'expense')}>
			Gastos
		</button>
		<button class="income" class:active={type === 'income'} onclick={() => (type = 'income')}>
			Ingresos
		</button>
		<button class="transfer" class:active={type === 'transfer'} onclick={() => (type = 'transfer')}>
			Transferencias
		</button>
	</div>

	<div class="money-tiles money-tiles-wrap">
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
								<Icon name="chevron-right" class={`tree-chevron${isExpanded ? ' expanded' : ''}`} />
							</button>
						{:else}
							<span class="tree-chevron-spacer"></span>
						{/if}

						<span class="cat-tree-name">
							{n.category.name}
						</span>

						<span class="cat-tree-meta">
							<span class="cat-tree-count" title="Movimientos">{n.totalCount}</span>
							<span class="cat-tree-share">{row.sharePct.toFixed(1)}%</span>
							<span class="cat-tree-amount {amountClass}">
								{sign}{formatMoney(n.totalAmount.toFixed(2))}
							</span>
						</span>
					</div>

					<div class="cat-tree-track">
						<div class="cat-tree-fill" style="width: {row.barPct}%"></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</BottomSheet>
