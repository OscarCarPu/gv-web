<script lang="ts">
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { RecurringCommitmentResponse } from '$lib/domains/tasks/types/Plan.types';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	let commitments = $state<RecurringCommitmentResponse[]>([]);
	let tasks = $state<TaskListItem[]>([]);

	let taskId = $state<number | null>(null);
	let label = $state('');
	let daysOfWeek = $state<number[]>([]);
	let startTime = $state('09:00');
	let endTime = $state('17:00');
	let saving = $state(false);

	$effect(() => {
		if (open) reload();
	});

	async function reload() {
		const [c, t] = await Promise.all([planApi.listCommitments(), tasksApi.listTasksFast()]);
		commitments = c;
		tasks = t;
	}

	function toggleDay(day: number) {
		daysOfWeek = daysOfWeek.includes(day)
			? daysOfWeek.filter((d) => d !== day)
			: [...daysOfWeek, day].sort();
	}

	async function create() {
		if (!taskId || !label.trim() || daysOfWeek.length === 0) return;
		saving = true;
		try {
			await planApi.createCommitment({
				task_id: taskId,
				label: label.trim(),
				days_of_week: daysOfWeek,
				start_time: startTime,
				end_time: endTime,
			});
			label = '';
			daysOfWeek = [];
			await reload();
			addToast('Commitment created');
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Error creating commitment', 'error');
		} finally {
			saving = false;
		}
	}

	async function toggleActive(c: RecurringCommitmentResponse) {
		try {
			await planApi.updateCommitment(c.id, { active: !c.active });
			await reload();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Error updating commitment', 'error');
		}
	}

	async function remove(c: RecurringCommitmentResponse) {
		try {
			await planApi.deleteCommitment(c.id);
			await reload();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Error deleting commitment', 'error');
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">Recurring commitments</h3>

	<ul class="cal-commitment-list">
		{#each commitments as c (c.id)}
			<li class="cal-commitment-row" class:inactive={!c.active}>
				<div class="cal-commitment-info">
					<span class="cal-commitment-label">{c.label}</span>
					<span class="cal-commitment-meta">
						{c.task_name} · {c.days_of_week.map((d) => DAY_LABELS[d]).join(' ')} · {c.start_time}–{c.end_time}
					</span>
				</div>
				<button
					type="button"
					class="btn-icon"
					onclick={() => toggleActive(c)}
					title="Toggle active"
				>
					<Icon name={c.active ? 'check-circle' : 'circle'} />
				</button>
				<button type="button" class="btn-icon" onclick={() => remove(c)} title="Delete">
					<Icon name="trash" />
				</button>
			</li>
		{/each}
	</ul>

	<div class="detail-form">
		<div class="detail-field">
			<label for="commitment-task">Task</label>
			<select id="commitment-task" bind:value={taskId}>
				<option value={null}>Select…</option>
				{#each tasks as task (task.id)}
					<option value={task.id}>{task.name}</option>
				{/each}
			</select>
		</div>
		<div class="detail-field">
			<label for="commitment-label">Label</label>
			<input id="commitment-label" type="text" bind:value={label} placeholder="Work" />
		</div>
		<div class="detail-field">
			<span class="cal-label">Days</span>
			<div class="cal-day-toggle">
				{#each DAY_LABELS as dayLabel, i (dayLabel)}
					<button type="button" class:active={daysOfWeek.includes(i)} onclick={() => toggleDay(i)}>
						{dayLabel}
					</button>
				{/each}
			</div>
		</div>
		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="commitment-start">Starts</label>
				<input id="commitment-start" type="time" bind:value={startTime} />
			</div>
			<div class="detail-field flex-1">
				<label for="commitment-end">Ends</label>
				<input id="commitment-end" type="time" bind:value={endTime} />
			</div>
		</div>
	</div>

	<div class="detail-actions">
		<button class="btn-primary" onclick={create} disabled={saving}>Add commitment</button>
	</div>
</BottomSheet>
