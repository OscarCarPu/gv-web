<script lang="ts">
	import { scaleTime } from 'd3-scale';
	import { LayerCake, Svg } from 'layercake';

	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import HistoryControls from '$shared/components/HistoryControls.svelte';
	import { habitsApi } from '$habits/api/habits.api';
	import type { HabitWithLog, HabitHistoryEntry } from '$habits/types/Habit.types';
	import Line from '$shared/components/chart/Line.svelte';
	import Area from '$shared/components/chart/Area.svelte';
	import AxisX from '$shared/components/chart/AxisX.svelte';
	import AxisY from '$shared/components/chart/AxisY.svelte';
	import Points from '$shared/components/chart/Points.svelte';

	let {
		habit,
		open,
		onclose,
	}: {
		habit: HabitWithLog;
		open: boolean;
		onclose: () => void;
	} = $props();

	function toDateStr(d: Date): string {
		return d.toISOString().split('T')[0];
	}

	let startAt = $state('');
	let endAt = $state('');
	let frequencyOverride: string | null = $state(null);
	const frequency = $derived(frequencyOverride ?? habit.frequency);
	let data: HabitHistoryEntry[] = $state([]);
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
		{ value: 'daily', icon: 'fa-solid fa-calendar-day' },
		{ value: 'weekly', icon: 'fa-solid fa-calendar-week' },
		{ value: 'monthly', icon: 'fa-solid fa-calendar' },
	] as const;

	async function fetchHistory() {
		if (!initialFetchDone) loading = true;
		try {
			const params: Record<string, string> = { frequency };
			if (startAt) params.start_at = startAt;
			if (endAt) params.end_at = endAt;
			const response = await habitsApi.getHistory(habit.id, params);
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
	<h3 class="modal-title">{habit.name}</h3>

	<HistoryControls
		{frequencies}
		{frequency}
		bind:startAt
		bind:endAt
		onfrequencychange={(v) => frequencyOverride = v}
		ondatechange={fetchHistory}
	/>

	{#if loading}
		<div class="history-loading">
			<div class="spinner"></div>
			Cargando...
		</div>
	{:else if chartData.length === 0}
		<div class="history-empty">
			<i class="fa-solid fa-chart-line text-2xl"></i>
			<span>Sin datos para este período</span>
			<span class="text-sm">Prueba ajustar las fechas</span>
		</div>
	{:else}
		<div class="chart-container">
			<LayerCake
				data={chartData}
				x="date"
				y="value"
				xScale={scaleTime()}
				yDomain={yDomain}
				padding={{ top: 10, right: 15, bottom: 30, left: 40 }}
				custom={{ frequency }}
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
