<script lang="ts">
	import { scaleTime } from 'd3-scale';
	import { LayerCake, Svg } from 'layercake';

	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import HistoryControls from '$shared/components/HistoryControls.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TimeEntryHistoryEntry } from '$lib/domains/tasks/types/Task.types';
	import Line from '$shared/components/chart/Line.svelte';
	import Area from '$shared/components/chart/Area.svelte';
	import AxisX from '$shared/components/chart/AxisX.svelte';
	import AxisY from '$shared/components/chart/AxisY.svelte';
	import Points from '$shared/components/chart/Points.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	let {
		open,
		onclose,
	}: {
		open: boolean;
		onclose: () => void;
	} = $props();

	function formatHours(v: number): string {
		const h = Math.floor(v);
		const m = Math.round((v - h) * 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	let startAt = $state('');
	let endAt = $state('');
	let frequency = $state('daily');
	let data: TimeEntryHistoryEntry[] = $state([]);
	let loading = $state(false);
	let initialFetchDone = $state(false);

	const chartData = $derived(
		data.map((d) => ({
			date: new Date(d.date + 'T00:00:00'),
			value: d.value,
		}))
	);

	const yDomain = $derived.by((): [number, number] => {
		if (chartData.length === 0) return [0, 1];
		const values = chartData.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || max || 1;
		const margin = range * 0.1;
		return [Math.max(0, min - margin), max + margin];
	});

	const frequencies = [
		{ value: 'daily', icon: 'calendar-day' },
		{ value: 'weekly', icon: 'calendar-week' },
		{ value: 'monthly', icon: 'calendar-solid' },
	] as const;

	async function fetchHistory() {
		if (!initialFetchDone) loading = true;
		try {
			const params: { frequency: string; start_at?: string; end_at?: string } = { frequency };
			if (startAt) params.start_at = startAt;
			if (endAt) params.end_at = endAt;
			const response = await tasksApi.getTimeEntryHistory(params);
			data = response.data;
			startAt = response.start_at;
			endAt = response.end_at;
			initialFetchDone = true;
		} catch {
			data = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			void frequency;
			fetchHistory();
		} else {
			initialFetchDone = false;
		}
	});
</script>

<BottomSheet {open} {onclose}>
	<h3 class="modal-title">Time history</h3>

	<HistoryControls
		{frequencies}
		{frequency}
		bind:startAt
		bind:endAt
		onfrequencychange={(v) => (frequency = v)}
		ondatechange={fetchHistory}
	/>

	{#if loading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if chartData.length === 0}
		<div class="history-empty">
			<Icon name="chart-line" class="text-2xl" />
			<span>No data for this period</span>
			<span class="text-sm">Try adjusting the dates</span>
		</div>
	{:else}
		<div class="chart-container">
			<LayerCake
				data={chartData}
				x="date"
				y="value"
				xScale={scaleTime()}
				{yDomain}
				padding={{ top: 10, right: 15, bottom: 30, left: 40 }}
				custom={{ frequency, formatValue: formatHours }}
			>
				<Svg>
					<AxisY />
					<AxisX />
					<Area />
					<Line />
					<Points />
				</Svg>
			</LayerCake>
		</div>
	{/if}
</BottomSheet>
