import type { ActiveTreeNode } from '$lib/domains/tasks/types/Task.types';

/** Depth-first list of every project in the tree, with nesting depth (for indented `<select>` options). */
export function flattenProjectsFromTree(
	nodes: ActiveTreeNode[],
	depth = 0
): { id: number; name: string; depth: number }[] {
	const result: { id: number; name: string; depth: number }[] = [];
	for (const node of nodes) {
		if (node.type === 'project') {
			result.push({ id: node.id, name: node.name, depth });
			if (node.children) result.push(...flattenProjectsFromTree(node.children, depth + 1));
		}
	}
	return result;
}

/** Set of `targetId` and all its descendant project ids (so a project filter includes sub-projects). */
export function collectProjectIds(nodes: ActiveTreeNode[], targetId: number): Set<number> {
	const ids = new Set<number>();
	function gather(node: ActiveTreeNode) {
		if (node.type === 'project') {
			ids.add(node.id);
			node.children?.forEach(gather);
		}
	}
	function find(ns: ActiveTreeNode[]): boolean {
		for (const node of ns) {
			if (node.type === 'project' && node.id === targetId) {
				gather(node);
				return true;
			}
			if (node.children && find(node.children)) return true;
		}
		return false;
	}
	find(nodes);
	return ids;
}

/** Tree with finished/pending nodes removed and tasks below the priority floor (`min`) hidden. */
export function filterTree(
	nodes: ActiveTreeNode[],
	min: number | null,
	pendingTasks: Set<number>,
	pendingProjects: Set<number>
): ActiveTreeNode[] {
	const result: ActiveTreeNode[] = [];
	for (const node of nodes) {
		if (node.type === 'project') {
			if (pendingProjects.has(node.id)) continue;
			result.push({
				...node,
				children: node.children
					? filterTree(node.children, min, pendingTasks, pendingProjects)
					: undefined,
			});
		} else {
			if (pendingTasks.has(node.id)) continue;
			if (min !== null && (node.priority ?? 3) > min) continue;
			result.push(node);
		}
	}
	return result;
}

export function findTreeTask(nodes: ActiveTreeNode[], id: number): ActiveTreeNode | undefined {
	for (const node of nodes) {
		if (node.type === 'task' && node.id === id) return node;
		if (node.children) {
			const found = findTreeTask(node.children, id);
			if (found) return found;
		}
	}
}

export function findTreeProject(nodes: ActiveTreeNode[], id: number): ActiveTreeNode | undefined {
	for (const node of nodes) {
		if (node.type === 'project') {
			if (node.id === id) return node;
			if (node.children) {
				const found = findTreeProject(node.children, id);
				if (found) return found;
			}
		}
	}
}
