import { describe, it, expect } from 'vitest';
import {
	buildCategoryStatTree,
	flattenCategoryStatTree,
	type CategoryStatNode,
} from '$lib/domains/money/utils/categoryTree';
import type { Category, CategoryStat } from '$lib/domains/money/types/Money.types';

function cat(over: Partial<Category> & { id: number; name: string }): Category {
	return {
		parent_id: null,
		type: 'expense',
		created_at: '2026-01-01T00:00:00Z',
		...over,
	};
}

function stat(over: Partial<CategoryStat> & { category_id: number }): CategoryStat {
	return {
		name: '',
		amount: '0',
		share: 0,
		tx_count: 0,
		...over,
	};
}

function byId(tree: CategoryStatNode[]): Map<number, CategoryStatNode> {
	const m = new Map<number, CategoryStatNode>();
	function walk(n: CategoryStatNode) {
		m.set(n.category.id, n);
		n.children.forEach(walk);
	}
	tree.forEach(walk);
	return m;
}

describe('buildCategoryStatTree', () => {
	it('filters by transaction type', () => {
		const categories: Category[] = [
			cat({ id: 1, name: 'Food', type: 'expense' }),
			cat({ id: 2, name: 'Salary', type: 'income' }),
		];
		const tree = buildCategoryStatTree(categories, [], 'expense');
		expect(tree.map((n) => n.category.id)).toEqual([1]);
	});

	it('returns [] when no categories match the type', () => {
		const categories: Category[] = [cat({ id: 1, name: 'Food', type: 'expense' })];
		expect(buildCategoryStatTree(categories, [], 'income')).toEqual([]);
	});

	it('attaches own amount/count and rolls up descendants into totals', () => {
		const categories: Category[] = [
			cat({ id: 1, name: 'Food' }),
			cat({ id: 2, name: 'Groceries', parent_id: 1 }),
			cat({ id: 3, name: 'Restaurants', parent_id: 1 }),
		];
		const stats: CategoryStat[] = [
			stat({ category_id: 1, amount: '10.00', tx_count: 1 }),
			stat({ category_id: 2, amount: '30.00', tx_count: 3 }),
			stat({ category_id: 3, amount: '20.00', tx_count: 2 }),
		];

		const tree = buildCategoryStatTree(categories, stats, 'expense');
		const nodes = byId(tree);
		const food = nodes.get(1)!;

		// Own vs descendant vs total.
		expect(food.ownAmount).toBe(10);
		expect(food.ownCount).toBe(1);
		expect(food.descendantAmount).toBe(50);
		expect(food.descendantCount).toBe(5);
		expect(food.totalAmount).toBe(60);
		expect(food.totalCount).toBe(6);

		// Leaf node: descendants are zero, total equals own.
		const groceries = nodes.get(2)!;
		expect(groceries.descendantAmount).toBe(0);
		expect(groceries.totalAmount).toBe(30);
		expect(groceries.depth).toBe(1);
	});

	it('defaults missing stats to zero amount/count', () => {
		const categories: Category[] = [cat({ id: 1, name: 'Food' })];
		const tree = buildCategoryStatTree(categories, [], 'expense');
		expect(tree[0].ownAmount).toBe(0);
		expect(tree[0].ownCount).toBe(0);
		expect(tree[0].totalAmount).toBe(0);
	});

	it('sorts roots by total amount descending', () => {
		const categories: Category[] = [
			cat({ id: 1, name: 'Small' }),
			cat({ id: 2, name: 'Big' }),
			cat({ id: 3, name: 'Mid' }),
		];
		const stats: CategoryStat[] = [
			stat({ category_id: 1, amount: '5.00' }),
			stat({ category_id: 2, amount: '100.00' }),
			stat({ category_id: 3, amount: '50.00' }),
		];
		const tree = buildCategoryStatTree(categories, stats, 'expense');
		expect(tree.map((n) => n.category.id)).toEqual([2, 3, 1]);
	});

	it('sorts children alphabetically by name', () => {
		const categories: Category[] = [
			cat({ id: 1, name: 'Parent' }),
			cat({ id: 2, name: 'Zebra', parent_id: 1 }),
			cat({ id: 3, name: 'Apple', parent_id: 1 }),
		];
		const tree = buildCategoryStatTree(categories, [], 'expense');
		expect(tree[0].children.map((n) => n.category.name)).toEqual(['Apple', 'Zebra']);
	});

	it('treats a child whose parent is absent/filtered out as a root', () => {
		const categories: Category[] = [
			// parent_id points to an income category not in the expense set
			cat({ id: 1, name: 'Salary', type: 'income' }),
			cat({ id: 2, name: 'Orphan', parent_id: 1, type: 'expense' }),
		];
		const tree = buildCategoryStatTree(categories, [], 'expense');
		expect(tree.map((n) => n.category.id)).toEqual([2]);
		expect(tree[0].depth).toBe(0);
	});
});

describe('flattenCategoryStatTree', () => {
	const categories: Category[] = [
		cat({ id: 1, name: 'Food' }),
		cat({ id: 2, name: 'Groceries', parent_id: 1 }),
	];
	const stats: CategoryStat[] = [
		stat({ category_id: 1, amount: '10.00', tx_count: 1 }),
		stat({ category_id: 2, amount: '30.00', tx_count: 3 }),
	];

	it('hides children when the parent is collapsed', () => {
		const tree = buildCategoryStatTree(categories, stats, 'expense');
		const total = tree.reduce((s, n) => s + n.totalAmount, 0);
		const rootMax = Math.max(0.01, ...tree.map((n) => n.totalAmount));

		const rows = flattenCategoryStatTree(tree, {}, total, rootMax);
		expect(rows.map((r) => r.node.category.id)).toEqual([1]);
		expect(rows[0].hasChildren).toBe(true);
	});

	it('reveals children when the parent is expanded and computes percentages', () => {
		const tree = buildCategoryStatTree(categories, stats, 'expense');
		const total = tree.reduce((s, n) => s + n.totalAmount, 0); // 40
		const rootMax = Math.max(0.01, ...tree.map((n) => n.totalAmount)); // 40

		const rows = flattenCategoryStatTree(tree, { 1: true }, total, rootMax);
		expect(rows.map((r) => r.node.category.id)).toEqual([1, 2]);

		const foodRow = rows[0];
		expect(foodRow.barPct).toBeCloseTo(100); // 40 / 40
		expect(foodRow.sharePct).toBeCloseTo(100); // total share 40 / 40
		expect(foodRow.ownSharePct).toBeCloseTo(25); // own 10 / 40

		const grocRow = rows[1];
		expect(grocRow.barPct).toBeCloseTo(75); // 30 / 40
		expect(grocRow.hasChildren).toBe(false);
	});
});
