<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { CalendarView } from '$lib/domains/calendar/calendarView.svelte';
	import MonthGrid from '$lib/domains/calendar/components/MonthGrid.svelte';
	import TimeGrid from '$lib/domains/calendar/components/TimeGrid.svelte';
	import CapacityPanel from '$lib/domains/calendar/components/CapacityPanel.svelte';
	import EventFormSheet from '$lib/domains/calendar/components/EventFormSheet.svelte';
	import CreatePlanFromEventWizard from '$lib/domains/calendar/components/CreatePlanFromEventWizard.svelte';
	import type { CalendarEvent, CalendarSource } from '$lib/domains/calendar/types/Calendar.types';
	import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
	import type { FreeBusyRangeResponse } from '$lib/domains/capacity/types/Capacity.types';
	import type { PlanTaskChoice } from '$lib/domains/calendar/utils/eventPlan';

	let {
		data,
	}: {
		data: {
			events: CalendarEvent[];
			planBlocks: PlanBlockResponse[];
			freeBusy: FreeBusyRangeResponse;
		};
	} = $props();

	// The SSR payload is a seed; the controller owns it from here on.
	// svelte-ignore state_referenced_locally
	const view = new CalendarView(
		data.events ?? [],
		'month',
		data.planBlocks ?? [],
		data.freeBusy?.days ?? []
	);

	let editing = $state<CalendarEvent | null>(null);
	let creatingOn = $state<Date | null>(null);
	let sheetOpen = $state(false);
	let sidebarOpen = $state(false);
	let planWizardOpen = $state(false);
	let planChoice = $state<PlanTaskChoice | null>(null);

	onMount(() => {
		// No fetch here on purpose: the server load seeded this range, and the client token is
		// installed by the root layout's effect, which has not run yet.
		view.restoreSource();
	});

	const sources: { value: CalendarSource; label: string }[] = [
		{ value: 'events', label: 'Events' },
		{ value: 'plans', label: 'Plans' },
		{ value: 'both', label: 'Both' },
	];

	function openEvent(event: CalendarEvent) {
		editing = event;
		creatingOn = null;
		sheetOpen = true;
	}

	function openCreate(day?: Date, hour?: number) {
		let when: Date | null = null;
		if (day) {
			when = new Date(day);
			when.setHours(hour ?? 9, 0, 0, 0);
		}
		editing = null;
		creatingOn = when;
		sheetOpen = true;
	}
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="cal-page">
	<header class="cal-toolbar">
		<div class="cal-toolbar-left">
			<button
				type="button"
				class="btn-icon cal-sidebar-btn"
				title="Free time"
				aria-label="Free time"
				onclick={() => (sidebarOpen = !sidebarOpen)}><Icon name="folder" /></button
			>
			<div class="cal-nav">
				<button
					type="button"
					class="btn-icon"
					title="Previous"
					aria-label="Previous"
					onclick={() => view.shift(-1)}><Icon name="arrow-left" /></button
				>
				<button
					type="button"
					class="cal-btn cal-today"
					class:current={view.isCurrentPeriod}
					onclick={() => view.goToday()}>Today</button
				>
				<button
					type="button"
					class="btn-icon"
					title="Next"
					aria-label="Next"
					onclick={() => view.shift(1)}><Icon name="arrow-right" /></button
				>
			</div>
			<h1 class="cal-title">{view.title}</h1>
			{#if view.loading}
				<span class="cal-loading" title="Loading"><Icon name="spinner" /></span>
			{/if}
		</div>

		<div class="cal-toolbar-right">
			<div class="create-mode-toggle cal-mode-toggle">
				{#each sources as source (source.value)}
					<button
						class:active={view.source === source.value}
						onclick={() => view.setSource(source.value)}>{source.label}</button
					>
				{/each}
			</div>
			<div class="create-mode-toggle cal-mode-toggle">
				<button class:active={view.mode === 'month'} onclick={() => view.setMode('month')}
					>Month</button
				>
				<button class:active={view.mode === 'week'} onclick={() => view.setMode('week')}
					>Week</button
				>
				<button class:active={view.mode === 'day'} onclick={() => view.setMode('day')}>Day</button>
			</div>
			<button type="button" class="btn-primary" title="New event" onclick={() => openCreate()}>
				<Icon name="plus" /> New
			</button>
		</div>
	</header>

	{#if view.error}
		<p class="cal-error cal-error-bar">{view.error}</p>
	{/if}

	<div class="cal-body">
		<div class="cal-sidebar-wrap" class:open={sidebarOpen}>
			<aside class="cal-sidebar">
				<CapacityPanel days={view.freeBusy} />
			</aside>
		</div>

		<main class="cal-main">
			{#if view.mode === 'month'}
				<MonthGrid {view} onselect={openEvent} oncreate={(day) => openCreate(day)} />
			{:else}
				<TimeGrid {view} onselect={openEvent} oncreate={(day, hour) => openCreate(day, hour)} />
			{/if}
		</main>
	</div>
</div>

<EventFormSheet
	open={sheetOpen}
	onclose={() => (sheetOpen = false)}
	event={editing}
	day={creatingOn}
	refresh={() => view.load()}
	hasPlan={editing ? view.hasPlan(editing.id) : false}
	oncreateplan={() => {
		sheetOpen = false;
		planChoice = null;
		planWizardOpen = true;
	}}
/>

<CreatePlanFromEventWizard
	open={planWizardOpen}
	onclose={() => (planWizardOpen = false)}
	event={editing}
	initialChoice={planChoice}
	refresh={() => view.load()}
/>
