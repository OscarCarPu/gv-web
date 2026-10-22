import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { isoToLocalInput, localInputToISO } from '$lib/domains/calendar/utils/datetime';
import {
	createEventPlan,
	planTaskChoiceValid,
	type PlanTaskMode,
} from '$lib/domains/calendar/utils/eventPlan';
import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

interface EventFormCallbacks {
	onclose: () => void;
	/** Reload the visible range once the write has landed. */
	refresh: () => Promise<void>;
}

/**
 * Owns the create/edit sheet: a name and a time range, plus, for a new event, an optional plan
 * block linked to it.
 *
 * Times are real instants, so the local input is converted with the zone offset (not the shared
 * `toISOString`, which would move every event by the offset).
 */
export class EventForm {
	#onclose: () => void;
	#refresh: () => Promise<void>;

	event = $state<CalendarEvent | null>(null);

	name = $state('');
	/** `YYYY-MM-DDTHH:MM`. */
	startTime = $state('');
	endTime = $state('');

	/** New events only: also create a plan block with the event's hours. */
	withPlan = $state(false);
	planTaskMode = $state<PlanTaskMode>('none');
	planTaskId = $state<number | null>(null);
	planNewTaskName = $state('');

	saving = $state(false);
	deleting = $state(false);
	nameError = $state(false);
	timeError = $state(false);

	constructor(callbacks: EventFormCallbacks) {
		this.#onclose = callbacks.onclose;
		this.#refresh = callbacks.refresh;
	}

	get isEdit(): boolean {
		return this.event !== null;
	}

	/** Seeds the form. `day` pre-fills a new event when the user clicked a specific day. */
	reset(event: CalendarEvent | null, day?: Date) {
		this.event = event;
		this.saving = false;
		this.deleting = false;
		this.nameError = false;
		this.timeError = false;
		this.withPlan = false;
		this.planTaskMode = 'none';
		this.planTaskId = null;
		this.planNewTaskName = '';

		if (event) {
			this.name = event.name;
			this.startTime = isoToLocalInput(event.start_time);
			this.endTime = isoToLocalInput(event.end_time);
			return;
		}

		// The caller decides the hour: an hour slot in the time grid carries the one clicked.
		const base = day ? new Date(day) : new Date();
		if (day) {
			base.setSeconds(0, 0);
		} else {
			base.setHours(base.getHours() + 1, 0, 0, 0);
		}
		this.name = '';
		this.startTime = isoToLocalInput(base.toISOString());
		this.endTime = isoToLocalInput(new Date(base.getTime() + 60 * 60 * 1000).toISOString());
	}

	private validate(): boolean {
		this.nameError = this.name.trim() === '';
		const start = new Date(this.startTime || '');
		const end = new Date(this.endTime || '');
		this.timeError = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start;
		if (this.nameError || this.timeError) return false;
		if (this.#planWanted() && !planTaskChoiceValid(this.#planChoice())) {
			addToast(
				this.planTaskMode === 'new' ? 'Name the new task' : 'Choose a task for the plan',
				'error'
			);
			return false;
		}
		return true;
	}

	async save() {
		if (this.saving || !this.validate()) return;
		this.saving = true;
		try {
			const start_time = localInputToISO(this.startTime);
			const end_time = localInputToISO(this.endTime);
			if (this.event) {
				await calendarApi.updateEvent(this.event.id, {
					name: this.name.trim(),
					start_time,
					end_time,
				});
				addToast('Event updated');
			} else {
				const created = await calendarApi.createEvent({
					name: this.name.trim(),
					start_time,
					end_time,
				});
				if (this.#planWanted()) {
					// The event already exists, so a failing plan is reported without undoing it.
					try {
						await createEventPlan(created, start_time, end_time, this.#planChoice());
						addToast('Event and plan created');
					} catch (e) {
						const message = e instanceof Error ? e.message : 'unknown error';
						addToast(`Event created, but the plan failed: ${message}`, 'error');
					}
				} else {
					addToast('Event created');
				}
			}
			await this.#refresh();
			this.#onclose();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			this.saving = false;
		}
	}

	#planWanted(): boolean {
		return !this.isEdit && this.withPlan;
	}

	#planChoice() {
		return { mode: this.planTaskMode, taskId: this.planTaskId, newTaskName: this.planNewTaskName };
	}

	async remove() {
		if (!this.event || this.deleting) return;
		this.deleting = true;
		try {
			await calendarApi.deleteEvent(this.event.id);
			addToast('Event deleted');
			await this.#refresh();
			this.#onclose();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
		} finally {
			this.deleting = false;
		}
	}
}
