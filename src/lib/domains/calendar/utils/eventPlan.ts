import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { planApi } from '$lib/domains/tasks/api/plan.api';
import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

export type PlanTaskMode = 'none' | 'existing' | 'new';

export interface PlanTaskChoice {
	mode: PlanTaskMode;
	taskId: number | null;
	newTaskName: string;
}

/** Whether the choice is complete enough to submit. */
export function planTaskChoiceValid(choice: PlanTaskChoice): boolean {
	if (choice.mode === 'existing') return choice.taskId !== null;
	if (choice.mode === 'new') return choice.newTaskName.trim() !== '';
	return true;
}

/**
 * Creates the plan block that hangs off `event` (via `event_ref`), creating the task first when
 * the choice asks for a new one. Without a task the block is labelled after the event.
 */
export async function createEventPlan(
	event: CalendarEvent,
	startIso: string,
	endIso: string,
	choice: PlanTaskChoice
) {
	let taskId: number | null = null;
	if (choice.mode === 'existing') {
		taskId = choice.taskId;
	} else if (choice.mode === 'new') {
		const created = await tasksApi.createTask({ name: choice.newTaskName.trim() });
		taskId = created.id;
	}

	return planApi.createBlock({
		started_at: startIso,
		ended_at: endIso,
		task_id: taskId,
		label: taskId ? undefined : event.summary || 'Event',
		event_ref: event.instance_id,
	});
}
