<script lang="ts">
	import type { CalendarEvent, CalendarItem } from '$lib/domains/calendar/types/Calendar.types';
	import { CalendarView, sameDay } from '$lib/domains/calendar/calendarView.svelte';
	import { eventTime } from '$lib/domains/calendar/utils/datetime';
	import Icon from '$lib/shared/components/Icon.svelte';

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

	function select(item: CalendarItem) {
		if (item.event) onselect(item.event);
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
			{@const dayEvents = view.itemsOn(day)}
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
					{#each visible as item (item.key)}
						<button
							type="button"
							class="cal-chip {item.kind}"
							class:planned={item.planned}
							class:static={!item.event}
							title={item.title}
							onclick={() => select(item)}
						>
							<span class="cal-chip-time">{eventTime(item.start)}</span>
							{#if item.planned}
								<span class="cal-planned" title="Has a plan"><Icon name="check-circle" /></span>
							{/if}
							<span class="cal-chip-title">{item.title || '(no title)'}</span>
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
