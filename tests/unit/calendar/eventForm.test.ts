import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();

vi.mock('$lib/domains/calendar/api/calendar.api', () => ({
	calendarApi: {
		createEvent: (...a: unknown[]) => createEvent(...a),
		updateEvent: (...a: unknown[]) => updateEvent(...a),
		deleteEvent: (...a: unknown[]) => deleteEvent(...a),
	},
}));

const createBlock = vi.fn();
const createTask = vi.fn();
vi.mock('$lib/domains/tasks/api/plan.api', () => ({
	planApi: { createBlock: (...a: unknown[]) => createBlock(...a) },
}));
vi.mock('$lib/domains/tasks/api/tasks.api', () => ({
	tasksApi: { createTask: (...a: unknown[]) => createTask(...a) },
}));

const toasts: { message: string; type?: string }[] = [];
vi.mock('$lib/shared/stores/toast.svelte', () => ({
	addToast: (message: string, type?: string) => toasts.push({ message, type }),
}));

import { EventForm } from '$lib/domains/calendar/forms/eventForm.svelte';

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: 7,
		name: 'Dentist',
		start_time: '2026-08-20T15:00:00Z',
		end_time: '2026-08-20T16:00:00Z',
		...over,
	};
}

function newForm() {
	const onclose = vi.fn();
	const refresh = vi.fn().mockResolvedValue(undefined);
	return { form: new EventForm({ onclose, refresh }), onclose, refresh };
}

beforeEach(() => {
	vi.clearAllMocks();
	toasts.length = 0;
});

describe('EventForm', () => {
	it('seeds the fields from an existing event, in local time', () => {
		const { form } = newForm();
		form.reset(event());
		expect(form.isEdit).toBe(true);
		expect(form.name).toBe('Dentist');
		expect(form.startTime).toBe('2026-08-20T17:00');
		expect(form.endTime).toBe('2026-08-20T18:00');
	});

	it('does not save without a name or with an end before the start', async () => {
		const { form } = newForm();
		form.reset(null, new Date(2026, 7, 20, 9));
		await form.save();
		expect(form.nameError).toBe(true);
		expect(createEvent).not.toHaveBeenCalled();

		form.name = 'x';
		form.endTime = form.startTime;
		await form.save();
		expect(form.timeError).toBe(true);
		expect(createEvent).not.toHaveBeenCalled();
	});

	it('creates an event with real instants', async () => {
		createEvent.mockResolvedValueOnce(event());
		const { form, onclose, refresh } = newForm();
		form.reset(null);
		form.name = ' Dentist ';
		form.startTime = '2026-08-20T17:00';
		form.endTime = '2026-08-20T18:00';
		await form.save();

		expect(createEvent).toHaveBeenCalledWith({
			name: 'Dentist',
			start_time: '2026-08-20T15:00:00.000Z',
			end_time: '2026-08-20T16:00:00.000Z',
		});
		expect(refresh).toHaveBeenCalled();
		expect(onclose).toHaveBeenCalled();
	});

	it('updates through the event id', async () => {
		updateEvent.mockResolvedValueOnce(event());
		const { form } = newForm();
		form.reset(event());
		form.name = 'Dentist (moved)';
		await form.save();
		expect(updateEvent).toHaveBeenCalledWith(
			7,
			expect.objectContaining({ name: 'Dentist (moved)' })
		);
	});

	it('creates a linked plan with the event hours', async () => {
		const created = event({ id: 9 });
		createEvent.mockResolvedValueOnce(created);
		createBlock.mockResolvedValueOnce({});
		const { form } = newForm();
		form.reset(null);
		form.name = 'Dentist';
		form.startTime = '2026-08-20T17:00';
		form.endTime = '2026-08-20T18:00';
		form.withPlan = true;
		await form.save();

		expect(createBlock).toHaveBeenCalledWith(
			expect.objectContaining({
				started_at: '2026-08-20T15:00:00.000Z',
				ended_at: '2026-08-20T16:00:00.000Z',
				event_ref: '9',
				label: 'Dentist',
			})
		);
	});

	it('keeps the event when its plan fails', async () => {
		createEvent.mockResolvedValueOnce(event());
		createBlock.mockRejectedValueOnce(new Error('overlap'));
		const { form, onclose } = newForm();
		form.reset(null);
		form.name = 'Dentist';
		form.withPlan = true;
		await form.save();

		expect(onclose).toHaveBeenCalled();
		expect(toasts.some((t) => t.type === 'error' && t.message.includes('overlap'))).toBe(true);
	});

	it('deletes by id', async () => {
		deleteEvent.mockResolvedValueOnce(undefined);
		const { form, onclose } = newForm();
		form.reset(event());
		await form.remove();
		expect(deleteEvent).toHaveBeenCalledWith(7);
		expect(onclose).toHaveBeenCalled();
	});
});
