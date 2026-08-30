<script lang="ts">
	import Modal from '$lib/shared/components/Modal.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import {
		hhmmToISO,
		isoToHHmm,
		toLocalDateString,
		formatDueDay,
	} from '$lib/shared/utils/datetime';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import type {
		CreatePlanBlockRequest,
		PlanBlockResponse,
	} from '$lib/domains/tasks/types/Plan.types';

	interface Props {
		open: boolean;
		block?: PlanBlockResponse | null;
		/** Day (local `YYYY-MM-DD`) a *new* block lands on; ignored when editing — an edited
		 *  block keeps its own day. Defaults to today. */
		date?: string;
		onclose: () => void;
		onsaved: () => void;
	}

	let { open, block = null, date, onclose, onsaved }: Props = $props();

	/** The day times in this form are anchored to: the block's own day when editing, otherwise
	 *  the day passed in (or today). */
	function anchorDate(): string {
		return block ? block.plan_date.slice(0, 10) : (date ?? toLocalDateString());
	}

	let tasks = $state<TaskListItem[]>([]);
	let mode = $state<'task' | 'free'>('task');
	let taskId = $state<number | null>(null);
	let label = $state('');
	let startTime = $state('09:00');
	let endTime = $state('10:00');
	let note = $state('');
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		tasksApi.listTasksFast().then((t) => (tasks = t));
		if (block) {
			mode = block.task_id !== null ? 'task' : 'free';
			taskId = block.task_id;
			label = block.label;
			startTime = isoToHHmm(block.started_at);
			endTime = isoToHHmm(block.ended_at);
			note = block.note ?? '';
		} else {
			mode = 'task';
			taskId = null;
			label = '';
			startTime = defaultStart();
			endTime = defaultEnd();
			note = '';
		}
	});

	function defaultStart(): string {
		const d = new Date();
		const h = String(d.getHours()).padStart(2, '0');
		return `${h}:00`;
	}

	function defaultEnd(): string {
		const d = new Date();
		const h = String((d.getHours() + 1) % 24).padStart(2, '0');
		return `${h}:00`;
	}

	interface TaskGroup {
		label: string;
		tasks: TaskListItem[];
	}

	const grouped = $derived.by((): TaskGroup[] => {
		const map = new Map<number | null, TaskGroup>();
		for (const t of tasks) {
			const key = t.project_id;
			if (!map.has(key)) {
				map.set(key, { label: t.project_name ?? 'No project', tasks: [] });
			}
			map.get(key)!.tasks.push(t);
		}
		return [...map.values()];
	});

	async function save() {
		if (saving) return;

		const day = anchorDate();
		const startedAt = hhmmToISO(startTime, false, day);
		const endedAt = hhmmToISO(endTime, true, day);
		if (new Date(endedAt) <= new Date(startedAt)) {
			addToast('End time must be after start time', 'error');
			return;
		}

		if (mode === 'task' && taskId === null) {
			addToast('Choose a task or switch to free time', 'error');
			return;
		}
		if (mode === 'free' && label.trim() === '') {
			addToast('Describe what you will do during free time', 'error');
			return;
		}

		saving = true;
		try {
			if (block) {
				await planApi.updateBlock(block.id, {
					started_at: startedAt,
					ended_at: endedAt,
					task_id: mode === 'task' ? taskId! : undefined,
					clear_task: mode === 'free',
					label: label.trim() || undefined,
					note: note.trim() ? note.trim() : undefined,
					clear_note: note.trim() === '',
				});
			} else {
				const payload: CreatePlanBlockRequest = {
					started_at: startedAt,
					ended_at: endedAt,
					task_id: mode === 'task' ? taskId : null,
					label: label.trim() || null,
					note: note.trim() || null,
				};
				await planApi.createBlock(payload);
			}
			onsaved();
			onclose();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error saving';
			addToast(msg, 'error');
		} finally {
			saving = false;
		}
	}
</script>

<Modal {open} {onclose}>
	<div class="plan-editor">
		<h3 class="plan-editor-title">{block ? 'Edit block' : 'New block'}</h3>
		<p class="plan-editor-date">{formatDueDay(`${anchorDate()}T00:00:00`)}</p>

		<div class="plan-editor-mode">
			<button class:active={mode === 'task'} onclick={() => (mode = 'task')}>Task</button>
			<button class:active={mode === 'free'} onclick={() => (mode = 'free')}>Free time</button>
		</div>

		<div class="plan-editor-times">
			<label>
				<span class="text-text-muted text-sm">From</span>
				<input type="time" bind:value={startTime} />
			</label>
			<label>
				<span class="text-text-muted text-sm">Until</span>
				<input type="time" bind:value={endTime} />
			</label>
		</div>

		{#if mode === 'task'}
			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">Task</span>
				<select
					bind:value={taskId}
					onchange={(e) => {
						const id = Number((e.target as HTMLSelectElement).value);
						const t = tasks.find((x) => x.id === id);
						if (t) label = t.name;
					}}
				>
					<option value={null}>Select a task...</option>
					{#each grouped as g (g.label)}
						<optgroup label={g.label}>
							{#each g.tasks as t (t.id)}
								<option value={t.id}>{t.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>

			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">Label (optional)</span>
				<input type="text" bind:value={label} placeholder="Defaults to the task name" />
			</label>
		{:else}
			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">What you will do</span>
				<input type="text" bind:value={label} placeholder="lunch, walk, gym..." />
			</label>
		{/if}

		<label class="detail-field">
			<span class="text-text-muted text-sm font-medium">Note (optional)</span>
			<textarea bind:value={note} rows="2"></textarea>
		</label>

		<div class="plan-editor-actions">
			<button class="btn-outline" onclick={onclose} disabled={saving}>Cancel</button>
			<button class="btn-primary" onclick={save} disabled={saving}>
				{block ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</Modal>
