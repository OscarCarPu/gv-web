import type { Category } from '../types/Money.types';

export interface CategoryOption {
	id: number;
	name: string;
	depth: number;
	label: string;
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
