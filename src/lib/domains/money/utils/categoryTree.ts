import type { Category, CategoryStat, CategoryTree, TransactionType } from '../types/Money.types';

export interface CategoryOption {
	id: number;
	name: string;
	depth: number;
	label: string;
}

/**
 * Build a plain parent/child nesting from a flat list. A category becomes a child
 * of its `parent_id` when that parent is present in `items`; otherwise it is a root.
 * Roots and children preserve the input order (the Categories card pre-filters by
 * type and relies on insertion order). Pure — no reactive state.
 */
export function buildCategoryTree(items: Category[]): CategoryTree[] {
	const byId = new Map<number, CategoryTree>();
	const roots: CategoryTree[] = [];
	items.forEach((c) => byId.set(c.id, { ...c, children: [] }));
	items.forEach((c) => {
		const node = byId.get(c.id)!;
		if (c.parent_id != null && byId.has(c.parent_id)) {
			byId.get(c.parent_id)!.children.push(node);
		} else {
			roots.push(node);
		}
	});
	return roots;
}

/**
 * Collect `id` plus all of its (transitive) descendant ids within `categories`.
 * Used by the category form's parent picker to ban selecting self or any descendant
 * (which would create a cycle). Pure — no reactive state.
 */
export function collectDescendantIds(categories: Category[], id: number): Set<number> {
	const banned = new Set<number>([id]);
	let added = true;
	while (added) {
		added = false;
		for (const c of categories) {
			if (c.parent_id != null && banned.has(c.parent_id) && !banned.has(c.id)) {
				banned.add(c.id);
				added = true;
			}
		}
	}
	return banned;
}

/** A category node with own / descendant / total amount + count rollups. */
export interface CategoryStatNode {
	category: Category;
	ownAmount: number;
	ownCount: number;
	descendantAmount: number;
	descendantCount: number;
	totalAmount: number;
	totalCount: number;
	depth: number;
	children: CategoryStatNode[];
}

/**
 * Build the typed category stat tree for one transaction type: filters categories
 * by `type`, attaches per-category amount/count from `stats`, rolls own + descendant
 * sums up the tree, and sorts each level (roots by total amount desc, children by
 * name). Pure — no reactive state. Mirrors `buildCategoryOptions` parent grouping.
 */
export function buildCategoryStatTree(
	categories: Category[],
	stats: CategoryStat[],
	type: TransactionType
): CategoryStatNode[] {
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

	function build(c: Category, depth: number): CategoryStatNode {
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
}

/** A flattened tree row with the bar / share percentages the list renders. */
export interface CategoryStatRow {
	node: CategoryStatNode;
	hasChildren: boolean;
	barPct: number;
	sharePct: number;
	ownSharePct: number;
}

/**
 * Depth-first walk of the stat tree into flat rows, descending into a node's
 * children only when its id is in `expanded`. `total` and `rootMax` drive the
 * share and bar-width percentages. Pure.
 */
export function flattenCategoryStatTree(
	tree: CategoryStatNode[],
	expanded: Record<number, true>,
	total: number,
	rootMax: number
): CategoryStatRow[] {
	const out: CategoryStatRow[] = [];
	function walk(node: CategoryStatNode) {
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
}

export function buildCategoryOptions(categories: Category[]): CategoryOption[] {
	const ids = new Set(categories.map((c) => c.id));
	const byParent = new Map<number, Category[]>();
	const roots: Category[] = [];
	for (const c of categories) {
		if (c.parent_id != null && ids.has(c.parent_id)) {
			if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, []);
			byParent.get(c.parent_id)!.push(c);
		} else {
			roots.push(c);
		}
	}
	const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
	roots.sort(byName);
	for (const arr of byParent.values()) arr.sort(byName);

	const INDENT = '    ';
	const out: CategoryOption[] = [];
	function walk(node: Category, depth: number) {
		out.push({
			id: node.id,
			name: node.name,
			depth,
			label: INDENT.repeat(depth) + node.name,
		});
		for (const k of byParent.get(node.id) ?? []) walk(k, depth + 1);
	}
	for (const r of roots) walk(r, 0);
	return out;
}
