<script lang="ts">
	import RightSheet from '$shared/components/RightSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';
	import { formatTime, toLocalDateString } from '$lib/shared/utils/datetime';
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

	let entries = $state<TimeEntryWithTask[]>([]);
	let loading = $state(false);
	let mode = $state<'day' | 'week'>('day');

	function getTimeWindow() {
		const now = new Date();
		const hours = mode === 'day' ? 24 : 24 * 7;
		const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
		return { start, end: now };
	}

	async function fetchEntries() {
		loading = true;
		try {
			const window = getTimeWindow();
			const result = await tasksApi.getTimeEntries({
				start_time: toLocalDateString(window.start),
			});
			const windowStartMs = window.start.getTime();
			entries = result.filter((e) => {
				const endMs = e.finished_at ? new Date(e.finished_at).getTime() : Date.now();
				return endMs >= windowStartMs;
			});
		} catch {
			entries = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			void mode;
			fetchEntries();
		}
	});

	type AgendaItem =
		| { type: 'entry'; entry: TimeEntryWithTask; hourLabel: string | null }
		| { type: 'gap'; duration: number; from: string; to: string }
		| { type: 'day'; label: string };

	const agendaItems = $derived.by((): AgendaItem[] => {
		// Sort ascending by started_at (full timestamp, not just hour)
		const sorted = [...entries].sort(
			(a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
		);

		const items: AgendaItem[] = [];
		let lastHourKey = '';

		for (let i = 0; i < sorted.length; i++) {
			const d = new Date(sorted[i].started_at);
			const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			const thisStart = new Date(sorted[i].started_at).getTime();

			if (i > 0) {
				const prevEntry = sorted[i - 1];
				const prevD = new Date(prevEntry.started_at);
				const prevDateKey = `${prevD.getFullYear()}-${prevD.getMonth()}-${prevD.getDate()}`;
				const finishedAt = prevEntry.finished_at;
				const prevEnd = finishedAt ? new Date(finishedAt).getTime() : Date.now();

				if (dateKey !== prevDateKey) {
					// Day boundary — split gap at midnight
					const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

					const gapBefore = (midnight - prevEnd) / 1000;
					if (gapBefore > 120) {
						items.push({
							type: 'gap',
							duration: gapBefore,
							from: new Date(prevEnd).toISOString(),
							to: new Date(midnight).toISOString(),
						});
					}

					items.push({ type: 'day', label: formatDay(d) });

					const gapAfter = (thisStart - midnight) / 1000;
					if (gapAfter > 120) {
						items.push({
							type: 'gap',
							duration: gapAfter,
							from: new Date(midnight).toISOString(),
							to: new Date(thisStart).toISOString(),
						});
					}
				} else {
					// Same day — normal gap
					const gap = (thisStart - prevEnd) / 1000;
					if (gap > 120) {
						items.push({
							type: 'gap',
							duration: gap,
							from: new Date(prevEnd).toISOString(),
							to: new Date(thisStart).toISOString(),
						});
					}
				}
			}

			// Compute hour label — show when the hour changes
			const hourKey = `${dateKey}-${d.getHours()}`;
			const hourLabel =
				hourKey !== lastHourKey ? `${String(d.getHours()).padStart(2, '0')}:00` : null;
			lastHourKey = hourKey;

			items.push({ type: 'entry', entry: sorted[i], hourLabel });
		}

		// Reverse for most-recent-first display
		return items.reverse();
	});

	function formatHour(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
	}

	function formatDay(d: Date): string {
		const weekday = d.toLocaleDateString('en', { weekday: 'long' });
		const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		return `${capitalized} ${d.getDate()}/${d.getMonth() + 1}`;
	}
</script>

<RightSheet {open} {onclose}>
	<div class="agenda-title">Agenda</div>
	<div class="agenda-subtitle-row">
		<span class="agenda-subtitle">{mode === 'day' ? 'Last 24 hours' : 'Last 7 days'}</span>
		<button
			class="agenda-mode-toggle"
			onclick={() => (mode = mode === 'day' ? 'week' : 'day')}
			aria-label={mode === 'day' ? 'View week' : 'View day'}
		>
			<Icon name={mode === 'day' ? 'calendar-week' : 'calendar-day'} />
		</button>
	</div>

	{#if loading}
		<div class="history-loading">
			<div class="spinner"></div>
			Loading...
		</div>
	{:else if entries.length === 0}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>No entries in the last 24 hours</span>
		</div>
	{:else}
		<div class="agenda-timeline">
			{#each agendaItems as item, i (item.type === 'entry' ? item.entry.id : item.type === 'day' ? `day-${i}` : `gap-${i}`)}
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
						<button
							class="agenda-entry"
							onclick={() => onopenentry(item.entry)}
						>
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
