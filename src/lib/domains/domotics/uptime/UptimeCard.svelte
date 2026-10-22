<script lang="ts">
	import { KIND_LABELS } from './api/uptime.schemas';
	import type { Overview } from './api/uptime.schemas';
	import { formatAgo, formatDuration, formatMoment, formatPercent } from './format';
	import type { UptimeController } from './uptime.svelte';

	let {
		overview,
		controller,
	}: {
		overview: Overview;
		controller: UptimeController;
	} = $props();

	const report = $derived(controller.report);
	const segments = $derived(controller.segments);
	const outages = $derived(controller.outages);

	const held = $derived.by(() => {
		const started = new Date(overview.up_since).getTime();
		return Number.isNaN(started) ? null : formatDuration((Date.now() - started) / 1000);
	});
</script>

<article class="uptime-card">
	<header class="uptime-card-head">
		<div class="uptime-card-title">
			<span class="uptime-dot is-up"></span>
			<h2>Service</h2>
		</div>
		<div class="uptime-state">
			<span class="uptime-state-word">Up</span>
			<span class="uptime-state-detail">
				{held ? `for ${held}` : ''} · since {formatMoment(overview.up_since)}
			</span>
		</div>
	</header>

	{#if overview.ranges.length > 0}
		<div class="uptime-tiles">
			{#each overview.ranges as range (range.range)}
				<div class="uptime-tile">
					<span class="uptime-tile-value">{formatPercent(range.uptime)}</span>
					<span class="uptime-tile-label">{range.range}</span>
					<span class="uptime-tile-since">
						{formatDuration(range.down_seconds)} down · {formatDuration(range.failover_seconds)} failover
					</span>
					<span class="uptime-tile-since">from {formatMoment(range.range_start)}</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="uptime-timeline">
		<div class="uptime-track" role="img" aria-label="Uptime timeline">
			{#each segments as segment, i (i)}
				<span
					class="uptime-seg is-{segment.kind}"
					style="left: {segment.left}%; width: {segment.width}%"
					title={segment.label}
				></span>
			{/each}
		</div>
		<div class="uptime-axis">
			<span>{report ? formatMoment(report.from) : ''}</span>
			<span>{report ? formatMoment(report.to) : 'now'}</span>
		</div>
		<ul class="uptime-legend">
			{#each Object.entries(KIND_LABELS) as [kind, label] (kind)}
				<li><span class="uptime-swatch is-{kind}"></span>{label}</li>
			{/each}
		</ul>
	</div>

	<footer class="uptime-card-foot">
		{#if report}
			<span class="uptime-foot-main">{formatPercent(report.uptime)} over the selected range</span>
			<span class="uptime-foot-detail">
				{report.outages}
				{report.outages === 1 ? 'downtime' : 'downtimes'} · {formatDuration(report.down_seconds)} down
				· {formatDuration(report.failover_seconds)} on failover
				{#if report.truncated}
					· list trimmed
				{/if}
			</span>
		{:else}
			<span class="uptime-foot-detail">Nothing recorded in this range.</span>
		{/if}
	</footer>

	{#if outages.length > 0}
		<ul class="uptime-outages">
			{#each outages as outage (outage.start_time)}
				<li>
					<span class="uptime-outage-when">{formatMoment(outage.start_time)}</span>
					<span class="uptime-outage-length">{formatDuration(outage.seconds)}</span>
					<span class="uptime-outage-ago">{formatAgo(outage.start_time)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</article>
