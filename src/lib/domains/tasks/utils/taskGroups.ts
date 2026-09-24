import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';

export interface TaskProjectGroup {
	projectId: number | null;
	label: string;
	tasks: TaskListItem[];
}

/**
 * Buckets tasks into one `<optgroup>` per project, in the order projects first appear (the API
 * already sorts the list). Tasks without a project go under "No project".
 */
export function groupTasksByProject(tasks: TaskListItem[]): TaskProjectGroup[] {
	const map = new Map<number | null, TaskProjectGroup>();
	for (const t of tasks) {
		const key = t.project_id;
		if (!map.has(key)) {
			map.set(key, { projectId: key, label: t.project_name ?? 'No project', tasks: [] });
		}
		map.get(key)!.tasks.push(t);
	}
	return [...map.values()];
}
