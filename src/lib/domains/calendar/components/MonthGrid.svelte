<script lang="ts">
	import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';
	import { CalendarView, sameDay } from '$lib/domains/calendar/calendarView.svelte';
	import { eventTime } from '$lib/domains/calendar/utils/datetime';

	interface Props {
		view: CalendarView;
		onselect: (event: CalendarEvent) => void;
		oncreate: (day: Date) => void;
	}

	let { view, onselect, oncreate }: Props = $props();

	/** Monday first: the week as it reads on a Spanish wall calendar. */
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	/**
	 * Past this a cell shows a count instead of more rows. Two plus the "+N more" line is what
	 * fits in the shortest row the grid allows, and a chip clipped in half reads as a bug.
	 */
	const MAX_PER_DAY = 2;

	const today = new Date();

	function chips(day: Date): CalendarEvent[] {
		return [...view.allDayOn(day), ...view.timedOn(day)];
	}
</script>

<div class="cal-month">
	<div class="cal-month-head">
		{#each WEEKDAYS as label (label)}
			<div class="cal-weekday">{label}</div>
		{/each}
	</div>

	<div class="cal-month-grid" style="--weeks: {view.monthWeeks}">
		{#each view.days as day (day.getTime())}
			{@const dayEvents = chips(day)}
			{@const visible = dayEvents.slice(0, MAX_PER_DAY)}
			{@const hidden = dayEvents.length - visible.length}
			<div
				class="cal-day"
				class:outside={!view.inCurrentMonth(day)}
				class:today={sameDay(day, today)}
			>
				<div class="cal-day-head">
					<button
						type="button"
						class="cal-day-number"
						title="Open this day"
						onclick={() => view.openDay(day)}>{day.getDate()}</button
					>
					<button
						type="button"
						class="cal-day-add"
						title="New event"
						aria-label="New event"
						onclick={() => oncreate(day)}>+</button
					>
				</div>

				<div class="cal-day-events">
					{#each visible as event (event.instance_id)}
						<button
							type="button"
							class="cal-chip"
							class:all-day={event.all_day}
							class:declined={event.status === 'tentative'}
							style="--chip: {event.color || 'var(--color-primary)'}"
							title={`${event.summary} — ${event.calendar_name} (${event.account_email})`}
							onclick={() => onselect(event)}
						>
							{#if !event.all_day}
								<span class="cal-chip-time">{eventTime(event.starts_at)}</span>
							{/if}
							<span class="cal-chip-title">{event.summary || '(no title)'}</span>
						</button>
					{/each}
					{#if hidden > 0}
						<button type="button" class="cal-more" onclick={() => view.openDay(day)}
							>+{hidden} more</button
						>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
