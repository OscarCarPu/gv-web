import { describe, expect, it } from 'vitest';
import { groupTasksByProject } from '$lib/domains/tasks/utils/taskGroups';
import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';

const task = (id: number, project_id: number | null, project_name: string | null) =>
	({ id, name: `t${id}`, project_id, project_name }) as TaskListItem;

describe('groupTasksByProject', () => {
	it('groups by project in first-seen order, with unassigned tasks under "No project"', () => {
		const groups = groupTasksByProject([
			task(1, 2, 'Home'),
			task(2, null, null),
			task(3, 1, 'Work'),
			task(4, 2, 'Home'),
		]);
		expect(groups.map((g) => [g.label, g.tasks.map((t) => t.id)])).toEqual([
			['Home', [1, 4]],
			['No project', [2]],
			['Work', [3]],
		]);
	});
});
