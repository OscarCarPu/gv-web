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
					addNotification('Tarea creada e iniciada', 'success');
				} else {
					addNotification('Tarea creada', 'success');
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
					addNotification('Proyecto creado e iniciado', 'success');
				} else {
					addNotification('Proyecto creado', 'success');
				}
			}

			onclose();
			await invalidateAll();
		} catch {
			addToast('Error al crear', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{currentMode === 'task' ? 'Nueva tarea' : 'Nuevo proyecto'}</h3>

	<div class="create-mode-toggle">
		<button class:active={currentMode === 'task'} onclick={() => (currentMode = 'task')}
			>Tarea</button
		>
		<button class:active={currentMode === 'project'} onclick={() => (currentMode = 'project')}
			>Proyecto</button
		>
	</div>

	<div class="detail-form">
		<div class="detail-field">
			<label for="create-name">Nombre</label>
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
			<label for="create-desc">Descripción</label>
			<textarea id="create-desc" bind:value={description} rows="2"></textarea>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field">
				<label for="dtp-create-due">Fecha límite</label>
				<DatetimePicker bind:value={dueAt} id="create-due" />
			</div>

			{#if currentMode === 'task'}
				<div class="detail-field flex-1">
					<label for="create-project">Proyecto</label>
					<select id="create-project" bind:value={selectedProjectId}>
						<option value={null}>Sin proyecto</option>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="detail-field">
					<label for="create-task-type">Tipo</label>
					<select id="create-task-type" bind:value={taskType}>
						<option value="standard">Estándar</option>
						<option value="continuous">Continua</option>
						<option value="recurring">Recurrente</option>
					</select>
				</div>
				{#if taskType === 'recurring'}
					<div class="detail-field">
						<label for="create-recurrence">Cada (días)</label>
						<input id="create-recurrence" type="number" min="1" bind:value={recurrence} />
					</div>
				{/if}
				<div class="detail-field">
					<label for="create-priority">Prioridad</label>
					<select id="create-priority" bind:value={priority}>
						<option value={1}>1 · Urgente</option>
						<option value={2}>2 · Alta</option>
						<option value={3}>3 · Media</option>
						<option value={4}>4 · Baja</option>
						<option value={5}>5 · Muy baja</option>
					</select>
				</div>
			{:else}
				<div class="detail-field flex-1">
					<label for="create-parent">Proyecto padre</label>
					<select id="create-parent" bind:value={selectedParentId}>
						<option value={null}>Raíz</option>
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
				label="Depende de"
				projectId={selectedProjectId}
			/>
		{/if}

		<div class="detail-actions">
			<button class="start-now-toggle mr-auto" type="button" onclick={() => (startNow = !startNow)}>
				<div class="toggle toggle-sm" class:on={startNow} class:off={!startNow}>
					<div class="knob"></div>
				</div>
				Empezar ya
			</button>
			<button class="btn-primary" onclick={create} disabled={saving}>Crear</button>
		</div>
	</div>
</BottomSheet>
