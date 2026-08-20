<script lang="ts">
	import { DEVICE_LABELS, type DeviceOverview } from './api/uptime.schemas';
	import { formatAgo, formatDuration, formatMoment, formatPercent } from './format';
	import type { UptimeController } from './uptime.svelte';

	let {
		device,
		controller,
	}: {
		device: DeviceOverview;
		controller: UptimeController;
	} = $props();

	const entry = $derived(controller.windowsFor(device.device));
	const segments = $derived(controller.segmentsFor(device.device));
	const outages = $derived(controller.outagesFor(device.device));

	/** How long the current state has held. The open window is the only duration we can be sure of. */
	const held = $derived.by(() => {
		if (!device.since) return null;
		const started = new Date(device.since).getTime();
		if (Number.isNaN(started)) return null;
		return formatDuration((Date.now() - started) / 1000);
	});
</script>

<article class="uptime-card" class:is-down={device.state === 'down'}>
	<header class="uptime-card-head">
		<div class="uptime-card-title">
			<span
				class="uptime-dot"
				class:is-up={device.state === 'up'}
				class:is-down={device.state === 'down'}
			></span>
			<h2>{DEVICE_LABELS[device.device]}</h2>
		</div>
		<div class="uptime-state">
			{#if device.state === 'unknown'}
				<span class="uptime-state-word">No data</span>
				<span class="uptime-state-detail">nothing published yet</span>
			{:else}
				<span class="uptime-state-word">{device.state === 'up' ? 'Up' : 'Down'}</span>
				<span class="uptime-state-detail">
					{held ? `for ${held}` : ''}
					{#if device.since}
						· since {formatMoment(device.since)}
					{/if}
				</span>
			{/if}
		</div>
	</header>

	{#if device.ranges.length > 0}
		<div class="uptime-tiles">
			{#each device.ranges as range (range.range)}
				<div class="uptime-tile">
					<span class="uptime-tile-value">{formatPercent(range.uptime)}</span>
					<span class="uptime-tile-label">{range.range}</span>
					<!-- Ranges are floored at the device's first event, so `all` and `year` can name
					     the same day on a young device. Showing the start makes that visible. -->
					<span class="uptime-tile-since">from {formatMoment(range.range_start)}</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="uptime-timeline">
		<div
			class="uptime-track"
			role="img"
			aria-label="Uptime timeline for {DEVICE_LABELS[device.device]}"
		>
			{#each segments as segment, i (i)}
				<span
					class="uptime-seg is-{segment.state}"
					style="left: {segment.left}%; width: {segment.width}%"
					title={segment.label}
				></span>
			{/each}
		</div>
		<div class="uptime-axis">
			<span>{controller.report ? formatMoment(controller.report.from) : ''}</span>
			<span>{controller.report ? formatMoment(controller.report.to) : 'now'}</span>
		</div>
	</div>

	<footer class="uptime-card-foot">
		{#if entry}
			<span class="uptime-foot-main">
				{formatPercent(entry.uptime)} over the selected range
			</span>
			<span class="uptime-foot-detail">
				{entry.outages}
				{entry.outages === 1 ? 'outage' : 'outages'} · {formatDuration(entry.down_seconds)} down
				{#if entry.truncated}
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
					<span class="uptime-outage-length">
						{formatDuration(outage.seconds)}
						{#if outage.end_time === null}
							· ongoing
						{/if}
					</span>
					<span class="uptime-outage-ago">{formatAgo(outage.start_time)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</article>
