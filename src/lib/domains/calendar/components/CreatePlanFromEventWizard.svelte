<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
	import { localInputToISO, isoToLocalInput } from '$lib/domains/calendar/utils/datetime';
	import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		event: CalendarEvent | null;
		refresh: () => Promise<void>;
	}

	let { open, onclose, event, refresh }: Props = $props();

	let taskMode = $state<'none' | 'existing' | 'new'>('none');
	let tasks = $state<TaskListItem[]>([]);
	let selectedTaskId = $state<number | null>(null);
	let newTaskName = $state('');
	let startedAt = $state('');
	let endedAt = $state('');
	let saving = $state(false);
	let timeError = $state(false);

	$effect(() => {
		if (open && event) {
			taskMode = 'none';
			selectedTaskId = null;
			newTaskName = '';
			startedAt = event.all_day ? '' : isoToLocalInput(event.starts_at);
			endedAt = event.all_day ? '' : isoToLocalInput(event.ends_at);
			timeError = false;
			tasksApi.listTasksFast().then((t) => (tasks = t));
		}
	});

	async function submit() {
		if (!event) return;
		if (!startedAt || !endedAt) {
			timeError = true;
			return;
		}
		const startIso = localInputToISO(startedAt);
		const endIso = localInputToISO(endedAt);
		if (new Date(endIso) <= new Date(startIso)) {
			timeError = true;
			return;
		}
		if (taskMode === 'new' && !newTaskName.trim()) return;

		saving = true;
		try {
			let taskId: number | null = null;
			if (taskMode === 'existing') {
				taskId = selectedTaskId;
			} else if (taskMode === 'new') {
				const created = await tasksApi.createTask({ name: newTaskName.trim() });
				taskId = created.id;
			}

			if (startIso !== event.starts_at || endIso !== event.ends_at) {
				await calendarApi.updateEvent(event.instance_id, { starts_at: startIso, ends_at: endIso });
			}

			await planApi.createBlock({
				started_at: startIso,
				ended_at: endIso,
				task_id: taskId,
				label: taskId ? undefined : event.summary || 'Event',
				event_ref: event.instance_id,
			});

			addToast('Plan created');
			onclose();
			await refresh();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Error creating plan', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">Create plan</h3>

	<div class="detail-form">
		<div class="detail-field">
			<span class="cal-label">Task</span>
			<div class="create-mode-toggle">
				<button class:active={taskMode === 'none'} onclick={() => (taskMode = 'none')}
					>No task</button
				>
				<button class:active={taskMode === 'existing'} onclick={() => (taskMode = 'existing')}
					>Existing</button
				>
				<button class:active={taskMode === 'new'} onclick={() => (taskMode = 'new')}>New</button>
			</div>
		</div>

		{#if taskMode === 'existing'}
			<div class="detail-field">
				<label for="plan-task-select">Choose a task</label>
				<select id="plan-task-select" bind:value={selectedTaskId}>
					<option value={null}>Select…</option>
					{#each tasks as task (task.id)}
						<option value={task.id}>{task.name}</option>
					{/each}
				</select>
			</div>
		{:else if taskMode === 'new'}
			<div class="detail-field">
				<label for="plan-task-new">New task name</label>
				<input id="plan-task-new" type="text" bind:value={newTaskName} />
			</div>
		{/if}

		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="plan-started">Starts</label>
				<input
					id="plan-started"
					type="datetime-local"
					bind:value={startedAt}
					class:field-error={timeError}
					oninput={() => (timeError = false)}
				/>
			</div>
			<div class="detail-field flex-1">
				<label for="plan-ended">Ends</label>
				<input
					id="plan-ended"
					type="datetime-local"
					bind:value={endedAt}
					class:field-error={timeError}
					oninput={() => (timeError = false)}
				/>
			</div>
		</div>
	</div>

	<div class="detail-actions">
		<button class="btn-primary" onclick={submit} disabled={saving}>
			{saving ? 'Creating…' : 'Create plan'}
		</button>
	</div>
</BottomSheet>
