<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { EventForm } from '$lib/domains/calendar/forms/eventForm.svelte';
	import PlanTaskPicker from '$lib/domains/calendar/components/PlanTaskPicker.svelte';
	import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		event?: CalendarEvent | null;
		/** Pre-fills the date of a new event when it was started from a day or an hour slot. */
		day?: Date | null;
		refresh: () => Promise<void>;
		/** Whether this event already has a plan_block linked to it. */
		hasPlan?: boolean;
		oncreateplan?: () => void;
	}

	let {
		open,
		onclose,
		event = null,
		day = null,
		refresh,
		hasPlan = false,
		oncreateplan,
	}: Props = $props();

	const form = new EventForm({
		onclose: () => onclose(),
		refresh: () => refresh(),
	});

	$effect(() => {
		if (open) form.reset(event, day ?? undefined);
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{form.isEdit ? 'Edit event' : 'New event'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="cal-name">Name</label>
			<input
				id="cal-name"
				type="text"
				bind:value={form.name}
				class:field-error={form.nameError}
				oninput={() => (form.nameError = false)}
				placeholder="Dentist"
			/>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="cal-start">Starts</label>
				<input
					id="cal-start"
					type="datetime-local"
					bind:value={form.startTime}
					class:field-error={form.timeError}
					oninput={() => (form.timeError = false)}
				/>
			</div>
			<div class="detail-field flex-1">
				<label for="cal-end">Ends</label>
				<input
					id="cal-end"
					type="datetime-local"
					bind:value={form.endTime}
					class:field-error={form.timeError}
					oninput={() => (form.timeError = false)}
				/>
			</div>
		</div>

		{#if !form.isEdit}
			<label class="cal-switch">
				<input type="checkbox" bind:checked={form.withPlan} />
				Create a linked plan
			</label>
			{#if form.withPlan}
				<PlanTaskPicker
					bind:mode={form.planTaskMode}
					bind:taskId={form.planTaskId}
					bind:newTaskName={form.planNewTaskName}
					idPrefix="cal-plan"
				/>
				<span class="cal-hint">The plan takes the event's hours and follows it when it moves.</span>
			{/if}
		{:else if !hasPlan}
			<button
				type="button"
				class="cal-btn"
				data-action="create-plan"
				onclick={() => oncreateplan?.()}
			>
				<Icon name="plus" /> Create plan
			</button>
		{/if}
	</div>

	<div class="detail-actions">
		<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
			{form.saving ? 'Saving…' : form.isEdit ? 'Save' : 'Create'}
		</button>
		{#if form.isEdit}
			<button
				class="btn-danger"
				onclick={() => form.remove()}
				disabled={form.deleting}
				title="Delete"
			>
				<Icon name="trash" />
				{form.deleting ? 'Deleting…' : 'Delete'}
			</button>
		{/if}
	</div>
</BottomSheet>
