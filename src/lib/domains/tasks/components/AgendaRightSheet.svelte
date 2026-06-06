<script lang="ts">
	import RightSheet from '$shared/components/RightSheet.svelte';
	import { Agenda } from '$lib/domains/tasks/agenda.svelte';
	import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';
	import { formatTime } from '$lib/shared/utils/datetime';
	import Icon from '$lib/shared/components/Icon.svelte';

	let {
		open,
		onclose,
		onopenentry,
	}: {
		open: boolean;
		onclose: () => void;
		onopenentry: (entry: TimeEntryWithTask) => void;
	} = $props();

	const agenda = new Agenda();

	$effect(() => {
		if (open) {
			void agenda.mode;
			agenda.load();
		}
	});

	function formatHour(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<RightSheet {open} {onclose}>
	<div class="agenda-title">Agenda</div>
	<div class="agenda-subtitle-row">
		<span class="agenda-subtitle">{agenda.mode === 'day' ? 'Last 24 hours' : 'Last 7 days'}</span>
		<button
			class="agenda-mode-toggle"
			onclick={() => agenda.toggleMode()}
			aria-label={agenda.mode === 'day' ? 'View week' : 'View day'}
		>
			<Icon name={agenda.mode === 'day' ? 'calendar-week' : 'calendar-day'} />
		</button>
	</div>

	{#if agenda.loading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if agenda.entries.length === 0}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>No entries in the last 24 hours</span>
		</div>
	{:else}
		<div class="agenda-timeline">
			{#each agenda.items as item, i (item.type === 'entry' ? item.entry.id : item.type === 'day' ? `day-${i}` : `gap-${i}`)}
				{#if item.type === 'day'}
					<div class="agenda-day-divider">
						<span class="agenda-day-line"></span>
						<span class="agenda-day-label">{item.label}</span>
						<span class="agenda-day-line"></span>
					</div>
				{:else if item.type === 'gap'}
					<div class="agenda-row">
						<span class="agenda-hour-label"></span>
						<div class="agenda-gap">
							<span class="agenda-gap-line"></span>
							<span class="agenda-gap-label">
								{#if item.duration >= 3600}
									{formatHour(item.from)} – {formatHour(item.to)} · {formatTime(item.duration)}
								{:else}
									{formatTime(item.duration)}
								{/if}
							</span>
							<span class="agenda-gap-line"></span>
						</div>
					</div>
				{:else}
					<div class="agenda-row">
						<span class="agenda-hour-label">{item.hourLabel ?? ''}</span>
						<button class="agenda-entry" onclick={() => onopenentry(item.entry)}>
							<div
								class="agenda-entry-bar"
								class:finished={item.entry.task_finished_at !== null}
								class:running={item.entry.finished_at === null}
							></div>
							<div class="agenda-entry-content">
								<div class="agenda-entry-name">{item.entry.task_name}</div>
								{#if item.entry.project_name}
									<div class="agenda-entry-project">{item.entry.project_name}</div>
								{/if}
								<div class="agenda-entry-row">
									<span class="agenda-entry-time">
										{formatHour(item.entry.started_at)} – {item.entry.finished_at
											? formatHour(item.entry.finished_at)
											: 'now'}
									</span>
									<span
										class="status-badge"
										class:started={item.entry.task_finished_at === null &&
											item.entry.task_type === 'standard'}
										class:continuous={item.entry.task_finished_at === null &&
											item.entry.task_type === 'continuous'}
										class:recurring={item.entry.task_finished_at === null &&
											item.entry.task_type === 'recurring'}
										class:finished={item.entry.task_finished_at !== null}
									>
										{item.entry.task_finished_at !== null
											? 'Finished'
											: item.entry.task_type === 'continuous'
												? 'Continuous'
												: item.entry.task_type === 'recurring'
													? `Recurring · ${item.entry.recurrence}`
													: 'In progress'}
									</span>
									<span class="agenda-entry-duration">{formatTime(item.entry.time_spent)}</span>
								</div>
							</div>
						</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</RightSheet>
