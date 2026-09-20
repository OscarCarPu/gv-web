<script lang="ts">
	import type { DayFreeBusy } from '$lib/domains/capacity/types/Capacity.types';
	import { formatFreeHours } from '$lib/domains/capacity/utils/freeHours';

	interface Props {
		days: DayFreeBusy[];
	}

	let { days }: Props = $props();

	const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' });
</script>

<div class="cal-capacity-panel">
	<div class="cal-capacity-header">
		<span class="cal-label">Free time (next 7 days)</span>
	</div>
	<ul class="cal-capacity-list">
		{#each days as day (day.date)}
			<li class="cal-capacity-row">
				<span class="cal-capacity-day">{dayLabel.format(new Date(`${day.date}T00:00:00`))}</span>
				<span class="cal-capacity-free">{formatFreeHours(day.free_hours)}</span>
				<span class="cal-capacity-total">/ {formatFreeHours(day.capacity_hours)}</span>
			</li>
		{/each}
	</ul>
</div>
