<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
	import { localInputToISO, isoToLocalInput } from '$lib/domains/calendar/utils/datetime';
	import {
		createEventPlan,
		planTaskChoiceValid,
		type PlanTaskChoice,
		type PlanTaskMode,
	} from '$lib/domains/calendar/utils/eventPlan';
	import PlanTaskPicker from '$lib/domains/calendar/components/PlanTaskPicker.svelte';
	import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		event: CalendarEvent | null;
		refresh: () => Promise<void>;
		/** Pre-selects the task, when it was already chosen while creating the event. */
		initialChoice?: PlanTaskChoice | null;
	}

	let { open, onclose, event, refresh, initialChoice = null }: Props = $props();

	let taskMode = $state<PlanTaskMode>('none');
	let selectedTaskId = $state<number | null>(null);
	let newTaskName = $state('');
	let startedAt = $state('');
	let endedAt = $state('');
	let saving = $state(false);
	let timeError = $state(false);

	$effect(() => {
		if (open && event) {
			taskMode = initialChoice?.mode ?? 'none';
			selectedTaskId = initialChoice?.taskId ?? null;
			newTaskName = initialChoice?.newTaskName ?? '';
			startedAt = event.all_day ? '' : isoToLocalInput(event.starts_at);
			endedAt = event.all_day ? '' : isoToLocalInput(event.ends_at);
			timeError = false;
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
		const choice = { mode: taskMode, taskId: selectedTaskId, newTaskName };
		if (!planTaskChoiceValid(choice)) {
			addToast(taskMode === 'new' ? 'Name the new task' : 'Choose a task', 'error');
			return;
		}

		saving = true;
		try {
			// An all-day event stays all-day: the plan carves hours out of that day, it does not
			// turn the event into a timed one (same as the Android wizard).
			if (!event.all_day && (startIso !== event.starts_at || endIso !== event.ends_at)) {
				await calendarApi.updateEvent(event.instance_id, { starts_at: startIso, ends_at: endIso });
			}

			await createEventPlan(event, startIso, endIso, choice);

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
		{#if open}
			<PlanTaskPicker
				bind:mode={taskMode}
				bind:taskId={selectedTaskId}
				bind:newTaskName
				idPrefix="plan-wizard"
			/>
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
