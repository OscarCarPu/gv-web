<script lang="ts">
	import RightSheet from '$shared/components/RightSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';
	import { formatTime, toLocalDateString } from '$lib/shared/utils/datetime';

	let {
		open,
		onclose,
		onopentask,
	}: {
		open: boolean;
		onclose: () => void;
		onopentask: (taskId: number, projectId: number | null) => void;
	} = $props();

	let entries = $state<TimeEntryWithTask[]>([]);
	let loading = $state(false);

	function getTimeWindow() {
		const now = new Date();
		const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
			fetchEntries();
		}
	});

	interface HourGroup {
		hour: number;
		label: string;
		entries: TimeEntryWithTask[];
	}

	const hourGroups = $derived.by((): HourGroup[] => {
		const window = getTimeWindow();
		const groups: HourGroup[] = [];

		// Build hours from most recent to oldest
		const endHour = window.end.getHours();
		for (let i = 0; i < 24; i++) {
			const h = (endHour - i + 24) % 24;
			groups.push({
				hour: h,
				label: `${String(h).padStart(2, '0')}:00`,
				entries: [],
			});
		}

		// Assign entries to the hour they started in
		for (const entry of entries) {
			const startHour = new Date(entry.started_at).getHours();
			const group = groups.find((g) => g.hour === startHour);
			if (group) group.entries.push(entry);
		}

		// Sort entries within each group: most recent first
		for (const group of groups) {
			group.entries.sort(
				(a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
			);
		}

		// Remove trailing empty hours (oldest with no entries)
		while (groups.length > 0 && groups[groups.length - 1].entries.length === 0) {
			groups.pop();
		}

		return groups;
	});

	function formatHour(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<RightSheet {open} {onclose}>
	<div class="agenda-title">Agenda</div>
	<div class="agenda-subtitle">Últimas 24 horas</div>

	{#if loading}
		<div class="history-loading">
			<div class="spinner"></div>
			Cargando...
		</div>
	{:else if entries.length === 0}
		<div class="history-empty">
			<i class="fa-solid fa-calendar-day text-2xl"></i>
			<span>Sin entradas en las últimas 24 horas</span>
		</div>
	{:else}
		<div class="agenda-timeline">
			{#each hourGroups as group (group.hour)}
				<div class="agenda-hour-group">
					<span class="agenda-hour-label">{group.label}</span>
					<div class="agenda-hour-entries">
						{#if group.entries.length === 0}
							<div class="agenda-hour-empty"></div>
						{:else}
							{#each group.entries as entry (entry.id)}
								<button
									class="agenda-entry"
									onclick={() => onopentask(entry.task_id, entry.project_id)}
								>
									<div
										class="agenda-entry-bar"
										class:finished={entry.task_finished_at !== null}
										class:running={entry.finished_at === null}
									></div>
									<div class="agenda-entry-content">
										<div class="agenda-entry-name">{entry.task_name}</div>
										{#if entry.project_name}
											<div class="agenda-entry-project">{entry.project_name}</div>
										{/if}
										<div class="agenda-entry-row">
											<span class="agenda-entry-time">
												{formatHour(entry.started_at)} – {entry.finished_at
													? formatHour(entry.finished_at)
													: 'ahora'}
											</span>
											<span
												class="status-badge"
												class:started={entry.task_finished_at === null}
												class:finished={entry.task_finished_at !== null}
											>
												{entry.task_finished_at !== null ? 'Finalizada' : 'En progreso'}
											</span>
											<span class="agenda-entry-duration">{formatTime(entry.time_spent)}</span>
										</div>
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</RightSheet>
