<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { toISOString } from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import type { ProjectListItem, TaskDepRef } from '$lib/domains/tasks/types/Task.types';
	import DepSelector from './DepSelector.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		mode: 'task' | 'project';
		prefillProjectId?: number | null;
		prefillParentId?: number | null;
	}

	let {
		open,
		onclose,
		mode = 'task',
		prefillProjectId = null,
		prefillParentId = null,
	}: Props = $props();

	let name = $state('');
	let description = $state('');
	let dueAt = $state('');
	let startNow = $state(false);
	let taskType = $state<'standard' | 'continuous' | 'recurring'>('standard');
	let recurrence = $state<number | null>(null);
	let priority = $state<number>(3);
	let selectedProjectId = $state<number | null>(null);
	let selectedParentId = $state<number | null>(null);
	let projects = $state<ProjectListItem[]>([]);
	let currentMode = $state<'task' | 'project'>('task');
	let saving = $state(false);
	let nameError = $state(false);
	let selectedDeps = $state<TaskDepRef[]>([]);

	$effect(() => {
		if (open) {
			currentMode = mode;
			name = '';
			description = '';
			dueAt = '';
			startNow = false;
			taskType = 'standard';
			recurrence = null;
			priority = 3;
			nameError = false;
			selectedDeps = [];
			selectedProjectId = prefillProjectId ?? prefillParentId ?? null;
			selectedParentId = prefillParentId ?? prefillProjectId ?? null;
			tasksApi.listProjectsFast().then((p) => (projects = p));
		}
	});

	async function create() {
		if (!name.trim()) {
			nameError = true;
			return;
		}

		saving = true;
		try {
			if (currentMode === 'task') {
				const created = await tasksApi.createTask({
					name: name.trim(),
					description: description || null,
					due_at: toISOString(dueAt),
					project_id: selectedProjectId,
					depends_on: selectedDeps.length > 0 ? selectedDeps.map((d) => d.id) : undefined,
					task_type: taskType !== 'standard' ? taskType : undefined,
					recurrence: taskType === 'recurring' ? recurrence : undefined,
					priority: priority !== 3 ? priority : undefined,
				});
				if (startNow) {
					await tasksApi.updateTask(created.id, { started_at: new Date().toISOString() });
					addNotification('Task created and started', 'success');
				} else {
					addNotification('Task created', 'success');
				}
			} else {
				const created = await tasksApi.createProject({
					name: name.trim(),
					description: description || null,
					due_at: toISOString(dueAt),
					parent_id: selectedParentId,
				});
				if (startNow) {
					await tasksApi.updateProject(created.id, { started_at: new Date().toISOString() });
					addNotification('Project created and started', 'success');
				} else {
					addNotification('Project created', 'success');
				}
			}

			onclose();
			await invalidateAll();
		} catch {
			addToast('Error creating', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{currentMode === 'task' ? 'New task' : 'New project'}</h3>

	<div class="create-mode-toggle">
		<button class:active={currentMode === 'task'} onclick={() => (currentMode = 'task')}
			>Task</button
		>
		<button class:active={currentMode === 'project'} onclick={() => (currentMode = 'project')}
			>Project</button
		>
	</div>

	<div class="detail-form">
		<div class="detail-field">
			<label for="create-name">Name</label>
			<input
				id="create-name"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
				onkeydown={(e) => e.key === 'Enter' && create()}
			/>
		</div>
		<div class="detail-field">
			<label for="create-desc">Description</label>
			<textarea id="create-desc" bind:value={description} rows="2"></textarea>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field">
				<label for="dtp-create-due">Due date</label>
				<DatetimePicker bind:value={dueAt} id="create-due" />
			</div>

			{#if currentMode === 'task'}
				<div class="detail-field flex-1">
					<label for="create-project">Project</label>
					<select id="create-project" bind:value={selectedProjectId}>
						<option value={null}>No project</option>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="detail-field">
					<label for="create-task-type">Type</label>
					<select id="create-task-type" bind:value={taskType}>
						<option value="standard">Standard</option>
						<option value="continuous">Continuous</option>
						<option value="recurring">Recurring</option>
					</select>
				</div>
				{#if taskType === 'recurring'}
					<div class="detail-field">
						<label for="create-recurrence">Every (days)</label>
						<input id="create-recurrence" type="number" min="1" bind:value={recurrence} />
					</div>
				{/if}
				<div class="detail-field">
					<label for="create-priority">Priority</label>
					<select id="create-priority" bind:value={priority}>
						<option value={1}>1 · Urgent</option>
						<option value={2}>2 · High</option>
						<option value={3}>3 · Medium</option>
						<option value={4}>4 · Low</option>
						<option value={5}>5 · Very low</option>
					</select>
				</div>
			{:else}
				<div class="detail-field flex-1">
					<label for="create-parent">Parent project</label>
					<select id="create-parent" bind:value={selectedParentId}>
						<option value={null}>Root</option>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		{#if currentMode === 'task'}
			<DepSelector
				selected={selectedDeps}
				onchange={(deps) => (selectedDeps = deps)}
				excludeId={-1}
				label="Depends on"
				projectId={selectedProjectId}
			/>
		{/if}

		<div class="detail-actions">
			<button class="start-now-toggle mr-auto" type="button" onclick={() => (startNow = !startNow)}>
				<div class="toggle toggle-sm" class:on={startNow} class:off={!startNow}>
					<div class="knob"></div>
				</div>
				Start now
			</button>
			<button class="btn-primary" onclick={create} disabled={saving}>Create</button>
		</div>
	</div>
</BottomSheet>
