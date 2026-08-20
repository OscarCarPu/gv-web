<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { EventForm } from '$lib/domains/calendar/forms/eventForm.svelte';
	import { eventWhen } from '$lib/domains/calendar/utils/datetime';
	import type { Calendar, CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		event?: CalendarEvent | null;
		/** Pre-fills the date of a new event when it was started from a day or an hour slot. */
		day?: Date | null;
		calendars: Calendar[];
		defaultCalendarId?: number;
		refresh: () => Promise<void>;
	}

	let {
		open,
		onclose,
		event = null,
		day = null,
		calendars,
		defaultCalendarId,
		refresh,
	}: Props = $props();

	const form = new EventForm(() => calendars, {
		onclose: () => onclose(),
		refresh: () => refresh(),
	});

	$effect(() => {
		if (open) form.reset(event, defaultCalendarId, day ?? undefined);
	});

	let moveTarget = $state<number | null>(null);
	$effect(() => {
		if (open) moveTarget = null;
	});

	const readOnly = $derived(event ? !event.editable : false);
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{form.isEdit ? 'Edit event' : 'New event'}</h3>

	{#if readOnly}
		<p class="cal-note">
			<Icon name="lock" /> This event cannot be edited: it comes from a read-only calendar or is generated
			by Google.
		</p>
	{/if}

	{#if form.canScope}
		<div class="create-mode-toggle cal-scope-toggle">
			<button class:active={form.scope === 'instance'} onclick={() => (form.scope = 'instance')}
				>This event</button
			>
			<button class:active={form.scope === 'following'} onclick={() => (form.scope = 'following')}
				>This and following</button
			>
			<button class:active={form.scope === 'all'} onclick={() => (form.scope = 'all')}
				>All events</button
			>
		</div>
	{/if}

	<div class="detail-form">
		<div class="detail-field">
			<label for="cal-summary">Title</label>
			<input
				id="cal-summary"
				type="text"
				bind:value={form.summary}
				disabled={readOnly}
				class:field-error={form.summaryError}
				oninput={() => (form.summaryError = false)}
				placeholder="Dentist"
			/>
		</div>

		<div class="detail-field">
			<label for="cal-calendar">Calendar</label>
			<select id="cal-calendar" bind:value={form.calendarId} disabled={readOnly || form.isEdit}>
				{#each calendars.filter((c) => c.writable && !c.deleted) as calendar (calendar.id)}
					<option value={calendar.id}>{calendar.summary} — {calendar.account_email}</option>
				{/each}
			</select>
			{#if form.isEdit && !readOnly}
				<span class="cal-hint">Use “Move” below to change the calendar.</span>
			{/if}
		</div>

		<label class="cal-switch">
			<input
				type="checkbox"
				checked={form.allDay}
				disabled={readOnly}
				onchange={(e) => form.setAllDay(e.currentTarget.checked)}
			/>
			All day
		</label>

		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="cal-start">Starts</label>
				<input
					id="cal-start"
					type={form.allDay ? 'date' : 'datetime-local'}
					bind:value={form.startsAt}
					disabled={readOnly}
					class:field-error={form.timeError}
					oninput={() => (form.timeError = false)}
				/>
			</div>
			<div class="detail-field flex-1">
				<label for="cal-end">{form.allDay ? 'Last day' : 'Ends'}</label>
				<input
					id="cal-end"
					type={form.allDay ? 'date' : 'datetime-local'}
					bind:value={form.endsAt}
					disabled={readOnly}
					class:field-error={form.timeError}
					oninput={() => (form.timeError = false)}
				/>
			</div>
		</div>

		<div class="detail-field">
			<label for="cal-repeat">Repeats</label>
			<select
				id="cal-repeat"
				bind:value={form.recurrence}
				disabled={readOnly || !form.canEditRecurrence}
			>
				<option value="none">Does not repeat</option>
				<option value="daily">Daily</option>
				<option value="weekly">Weekly</option>
				<option value="monthly">Monthly</option>
				<option value="yearly">Yearly</option>
				{#if form.recurrence === 'custom'}
					<option value="custom">Custom rule (kept as it is)</option>
				{/if}
			</select>
			{#if !form.canEditRecurrence}
				<span class="cal-hint">Switch to “All events” to change how it repeats.</span>
			{/if}
		</div>

		<div class="detail-field">
			<label for="cal-location">Location</label>
			<input id="cal-location" type="text" bind:value={form.location} disabled={readOnly} />
		</div>

		<div class="detail-field">
			<label for="cal-description">Notes</label>
			<textarea id="cal-description" rows="3" bind:value={form.description} disabled={readOnly}
			></textarea>
		</div>

		{#if form.hasAttendees}
			<div class="detail-field">
				<span class="cal-label">Guests</span>
				<ul class="cal-guests">
					{#each event?.attendees ?? [] as guest (guest.email)}
						<li>
							<span>{guest.display_name || guest.email}</span>
							{#if guest.response_status}<span class="cal-guest-status"
									>{guest.response_status}</span
								>{/if}
						</li>
					{/each}
				</ul>
				<div class="detail-field">
					<label for="cal-notify">Notify guests</label>
					<select id="cal-notify" bind:value={form.sendUpdates}>
						<option value="none">Don't notify</option>
						<option value="externalOnly">External guests only</option>
						<option value="all">Everyone</option>
					</select>
				</div>
			</div>
		{/if}

		{#if event}
			<p class="cal-meta">
				{eventWhen(event.starts_at, event.ends_at, event.all_day, event.start_date, event.end_date)} ·
				{event.calendar_name} · {event.account_email}
				{#if event.html_link}
					· <a href={event.html_link} target="_blank" rel="noreferrer">Open in Google</a>
				{/if}
			</p>
		{/if}
	</div>

	{#if !readOnly}
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

		{#if form.isEdit && !form.canScope}
			<div class="cal-move">
				<label for="cal-move-target">Move to</label>
				<select id="cal-move-target" bind:value={moveTarget}>
					<option value={null}>Choose a calendar…</option>
					{#each calendars.filter((c) => c.writable && !c.deleted && c.id !== event?.calendar_id) as calendar (calendar.id)}
						<option value={calendar.id}>{calendar.summary} — {calendar.account_email}</option>
					{/each}
				</select>
				<button
					class="cal-btn"
					disabled={moveTarget === null || form.saving}
					onclick={() => moveTarget !== null && form.move(moveTarget)}>Move</button
				>
			</div>
			{#if moveTarget !== null && calendars.find((c) => c.id === moveTarget)?.account_id !== event?.account_id}
				<p class="cal-note">
					<Icon name="circle-exclamation" /> Google cannot move an event between accounts: it will be
					recreated there with a new id, and guest replies are lost.
				</p>
			{/if}
		{/if}
	{/if}
</BottomSheet>
