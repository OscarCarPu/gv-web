<script lang="ts">
	import BottomSheet from '$shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TimeEntries } from '$lib/domains/tasks/timeEntries.svelte';
	import type { TimeEntryWithTask, TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import { isoToLocalInput } from '$lib/shared/utils/datetime';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		entry: TimeEntryWithTask | null;
		onclose: () => void;
		onupdated: () => void;
		ondeleted: () => void;
		/** All writes go through the page's single `TimeEntries` instance. */
		entries: TimeEntries;
	}

	let { entry, onclose, onupdated, ondeleted, entries }: Props = $props();

	let tasks = $state<TaskListItem[]>([]);
	let taskId = $state<number>(0);

	type TaskGroup = { projectName: string | null; tasks: TaskListItem[] };

	const taskGroups = $derived.by((): TaskGroup[] => {
		const map = new Map<string, TaskGroup>();
		for (const t of tasks) {
			const key = t.project_id !== null ? String(t.project_id) : '__none__';
			if (!map.has(key)) map.set(key, { projectName: t.project_name, tasks: [] });
			map.get(key)!.tasks.push(t);
		}
		const none = map.get('__none__');
		const groups = [...map.entries()]
			.filter(([k]) => k !== '__none__')
			.map(([, g]) => g)
			.sort((a, b) => (a.projectName ?? '').localeCompare(b.projectName ?? ''));
		if (none) groups.push(none);
		return groups;
	});
	let startedAt = $state('');
	let finishedAt = $state('');
	let saving = $state(false);

	$effect(() => {
		if (entry) {
			taskId = entry.task_id;
			startedAt = isoToLocalInput(entry.started_at);
			finishedAt = isoToLocalInput(entry.finished_at);
			void loadTasks();
		}
	});

	async function loadTasks() {
		if (tasks.length > 0) return;
		try {
			tasks = await tasksApi.listTasksFast();
		} catch {
			// keep empty
		}
	}

	async function handleSave() {
		if (!entry || !taskId || !startedAt) return;
		saving = true;
		try {
			await entries.update(entry.id, {
				task_id: taskId,
				started_at: new Date(startedAt).toISOString(),
				finished_at: finishedAt ? new Date(finishedAt).toISOString() : null,
			});
			onupdated();
			onclose();
		} catch {
			addToast('Failed to save time entry', 'error');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!entry) return;
		try {
			await entries.remove(entry.id);
			ondeleted();
			onclose();
		} catch {
			addToast('Failed to delete time entry', 'error');
		}
	}
</script>

<BottomSheet open={entry !== null} {onclose} constrained>
	<div class="time-entry-sheet">
		<h2 class="time-entry-sheet-title">Edit Time Entry</h2>
		<div class="time-entry-sheet-fields">
			<div class="time-entry-sheet-field">
				<label class="time-entry-sheet-label" for="te-task">Task</label>
				<select id="te-task" class="time-entry-sheet-select" bind:value={taskId}>
					{#each taskGroups as group}
						{#if group.projectName !== null}
							<optgroup label={group.projectName}>
								{#each group.tasks as task (task.id)}
									<option value={task.id}>{task.name}</option>
								{/each}
							</optgroup>
						{:else}
							{#each group.tasks as task (task.id)}
								<option value={task.id}>{task.name}</option>
							{/each}
						{/if}
					{/each}
				</select>
			</div>
			<div class="time-entry-sheet-field">
				<label class="time-entry-sheet-label" for="te-start">Start</label>
				<input
					id="te-start"
					class="time-entry-sheet-input"
					type="datetime-local"
					bind:value={startedAt}
				/>
			</div>
			<div class="time-entry-sheet-field">
				<label class="time-entry-sheet-label" for="te-end">End</label>
				<input
					id="te-end"
					class="time-entry-sheet-input"
					type="datetime-local"
					bind:value={finishedAt}
				/>
			</div>
		</div>
		<div class="time-entry-sheet-actions">
			<button class="btn-danger" onclick={handleDelete}>
				<Icon name="trash" />
				Delete
			</button>
			<button class="btn-primary" onclick={handleSave} disabled={saving || !taskId || !startedAt}>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</div>
</BottomSheet>
