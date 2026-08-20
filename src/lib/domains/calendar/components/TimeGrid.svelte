<script lang="ts">
	import type { CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';
	import { CalendarView, sameDay } from '$lib/domains/calendar/calendarView.svelte';
	import { chipInk, eventTime } from '$lib/domains/calendar/utils/datetime';

	interface Props {
		view: CalendarView;
		onselect: (event: CalendarEvent) => void;
		oncreate: (day: Date, hour: number) => void;
	}

	let { view, onselect, oncreate }: Props = $props();

	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' });

	const today = new Date();
	// The now line only makes sense while the clock is on screen, so it ticks rather than being
	// frozen at page load.
	let now = $state(new Date());
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});

	/**
	 * Opens on the working part of the day: midnight is almost never what someone wants to look
	 * at, so the body is scrolled to an hour before the first event, or to 08:00 when the day is
	 * empty.
	 */
	let body = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!body) return;
		const firsts = view.days
			.flatMap((day) => view.timedOn(day).slice(0, 1))
			.map((event) => new Date(event.starts_at).getHours());
		const hour = firsts.length ? Math.max(Math.min(...firsts) - 1, 0) : 8;
		const hourPx = body.scrollHeight / 24;
		body.scrollTop = hour * hourPx;
	});

	/** Minutes from midnight, clamped to the day: a multi-day event is drawn to the edges. */
	function span(event: CalendarEvent, day: Date) {
		const dayStart = new Date(day);
		dayStart.setHours(0, 0, 0, 0);
		const dayEnd = dayStart.getTime() + 86_400_000;
		const start = Math.max(new Date(event.starts_at).getTime(), dayStart.getTime());
		const end = Math.min(new Date(event.ends_at).getTime(), dayEnd);
		const top = (start - dayStart.getTime()) / 60_000;
		// A zero-length event still needs to be clickable.
		const height = Math.max((end - start) / 60_000, 20);
		return { top, height };
	}

	/**
	 * Lays overlapping events side by side. Events are walked in start order and each one takes
	 * the first lane whose last event has already finished, which is enough to stop two
	 * appointments at the same hour hiding one another.
	 */
	function laid(day: Date) {
		const events = view.timedOn(day);
		const laneEnds: number[] = [];
		const placed = events.map((event) => {
			const start = new Date(event.starts_at).getTime();
			const end = new Date(event.ends_at).getTime();
			let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
			if (lane === -1) {
				lane = laneEnds.length;
			}
			laneEnds[lane] = end;
			return { event, lane };
		});
		return { placed, lanes: Math.max(laneEnds.length, 1) };
	}
</script>

<div class="cal-time" class:single={view.mode === 'day'}>
	<div class="cal-time-head">
		<div class="cal-gutter-head"></div>
		{#each view.days as day (day.getTime())}
			<div class="cal-time-col-head" class:today={sameDay(day, today)}>
				<button type="button" class="cal-col-label" onclick={() => view.openDay(day)}>
					{dayLabel.format(day)}
				</button>
				<div class="cal-allday-row">
					{#each view.allDayOn(day) as event (event.instance_id)}
						<button
							type="button"
							class="cal-chip all-day"
							style="--chip: {event.color}; --chip-ink: {chipInk(event.color)}"
							title={`${event.summary} — ${event.calendar_name}`}
							onclick={() => onselect(event)}
						>
							<span class="cal-chip-title">{event.summary || '(no title)'}</span>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="cal-time-body" bind:this={body}>
		<div class="cal-gutter">
			{#each HOURS as hour (hour)}
				<div class="cal-hour-label">{String(hour).padStart(2, '0')}:00</div>
			{/each}
		</div>

		{#each view.days as day (day.getTime())}
			{@const layout = laid(day)}
			<div class="cal-time-col" class:today={sameDay(day, today)}>
				{#each HOURS as hour (hour)}
					<button
						type="button"
						class="cal-hour-slot"
						title="New event"
						aria-label={`New event at ${hour}:00`}
						onclick={() => oncreate(day, hour)}
					></button>
				{/each}

				{#if sameDay(day, now)}
					<div
						class="cal-now"
						style="--top: {now.getHours() * 60 + now.getMinutes()}"
						aria-hidden="true"
					></div>
				{/if}

				{#each layout.placed as { event, lane } (event.instance_id)}
					{@const box = span(event, day)}
					<button
						type="button"
						class="cal-event"
						class:tentative={event.status === 'tentative'}
						style="--top: {box.top}; --height: {box.height}; --lane: {lane}; --lanes: {layout.lanes}; --chip: {event.color}; --chip-ink: {chipInk(
							event.color
						)}"
						title={`${event.summary} — ${event.calendar_name} (${event.account_email})`}
						onclick={() => onselect(event)}
					>
						<span class="cal-event-time">{eventTime(event.starts_at)}</span>
						<span class="cal-event-title">{event.summary || '(no title)'}</span>
						{#if event.location}
							<span class="cal-event-where">{event.location}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/each}
	</div>
</div>
