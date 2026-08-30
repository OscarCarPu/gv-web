<script lang="ts">
	import type { DayFreeBusy } from '$lib/domains/capacity/types/Capacity.types';

	interface Props {
		days: DayFreeBusy[];
	}

	let { days }: Props = $props();

	const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' });

	function fmt(hours: string): string {
		const n = parseFloat(hours);
		return Number.isFinite(n) ? `${n.toFixed(1)}h` : hours;
	}
</script>

<div class="cal-capacity-panel">
	<div class="cal-capacity-header">
		<span class="cal-label">Free time (next 7 days)</span>
	</div>
	<ul class="cal-capacity-list">
		{#each days as day (day.date)}
			<li class="cal-capacity-row">
				<span class="cal-capacity-day">{dayLabel.format(new Date(`${day.date}T00:00:00`))}</span>
				<span class="cal-capacity-free">{fmt(day.free_hours)}</span>
				<span class="cal-capacity-total">/ {fmt(day.capacity_hours)}</span>
			</li>
		{/each}
	</ul>
</div>
