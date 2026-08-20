<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { CalendarView } from '$lib/domains/calendar/calendarView.svelte';
	import MonthGrid from '$lib/domains/calendar/components/MonthGrid.svelte';
	import TimeGrid from '$lib/domains/calendar/components/TimeGrid.svelte';
	import CalendarSidebar from '$lib/domains/calendar/components/CalendarSidebar.svelte';
	import AccountsSheet from '$lib/domains/calendar/components/AccountsSheet.svelte';
	import EventFormSheet from '$lib/domains/calendar/components/EventFormSheet.svelte';
	import type { Calendar, CalendarEvent } from '$lib/domains/calendar/types/Calendar.types';

	let { data }: { data: { calendars: Calendar[]; events: CalendarEvent[] } } = $props();

	// The SSR payload is a seed; the controller owns it from here on.
	// svelte-ignore state_referenced_locally
	const view = new CalendarView(data.calendars ?? [], data.events ?? []);

	let editing = $state<CalendarEvent | null>(null);
	let creatingOn = $state<Date | null>(null);
	let sheetOpen = $state(false);
	let accountsOpen = $state(false);
	let sidebarOpen = $state(false);

	onMount(() => {
		// The consent flow comes back through the API, which redirects here with the outcome.
		const connected = page.url.searchParams.get('connected');
		const failed = page.url.searchParams.get('error');
		if (connected) {
			addToast(`Connected ${connected}`);
		} else if (failed) {
			addToast(`Google refused the connection: ${failed}`, 'error');
		}
		if (connected || failed) {
			// The page was just re-rendered by the API's redirect, so the server load already
			// carries the new account; only the URL needs tidying.
			replaceState('/calendar', {});
		}

		// No fetch here on purpose: the server load seeded this range, and the client token is
		// installed by the root layout's effect, which has not run yet.
		return view.connect();
	});

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

	const canCreate = $derived(view.writableCalendars.length > 0);
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="cal-page">
	<header class="cal-toolbar">
		<div class="cal-toolbar-left">
			<button
				type="button"
				class="btn-icon cal-sidebar-btn"
				title="Calendars"
				aria-label="Calendars"
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
				<button class:active={view.mode === 'month'} onclick={() => view.setMode('month')}
					>Month</button
				>
				<button class:active={view.mode === 'week'} onclick={() => view.setMode('week')}
					>Week</button
				>
				<button class:active={view.mode === 'day'} onclick={() => view.setMode('day')}>Day</button>
			</div>
			<button
				type="button"
				class="btn-primary"
				disabled={!canCreate}
				title={canCreate ? 'New event' : 'No writable calendar is connected'}
				onclick={() => openCreate()}
			>
				<Icon name="plus" /> New
			</button>
		</div>
	</header>

	{#if view.error}
		<p class="cal-error cal-error-bar">{view.error}</p>
	{/if}

	<div class="cal-body">
		<div class="cal-sidebar-wrap" class:open={sidebarOpen}>
			<CalendarSidebar {view} onmanage={() => (accountsOpen = true)} />
		</div>

		<main class="cal-main">
			{#if view.calendars.length === 0}
				<div class="cal-empty">
					<h2>No calendars yet</h2>
					<p>Connect a Google account and its calendars will be mirrored here.</p>
					<button class="btn-primary" onclick={() => (accountsOpen = true)}>
						<Icon name="plus" /> Connect an account
					</button>
				</div>
			{:else if view.mode === 'month'}
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
	calendars={view.calendars}
	defaultCalendarId={view.defaultCalendarId}
	refresh={() => view.load()}
/>

<AccountsSheet
	open={accountsOpen}
	onclose={() => (accountsOpen = false)}
	refresh={async () => {
		await view.reloadCalendars();
		await view.load();
	}}
/>
