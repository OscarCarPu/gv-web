<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { toISOString } from '$lib/shared/utils/datetime';
	import type { ProjectListItem } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		mode: 'task' | 'project';
		prefillProjectId?: number | null;
		prefillParentId?: number | null;
	}

	let { open, onclose, mode = 'task', prefillProjectId = null, prefillParentId = null }: Props = $props();

	let name = $state('');
	let description = $state('');
	let dueAt = $state('');
	let startNow = $state(false);
	let selectedProjectId = $state<number | null>(null);
	let selectedParentId = $state<number | null>(null);
	let projects = $state<ProjectListItem[]>([]);
	let currentMode = $state<'task' | 'project'>('task');

	$effect(() => {
		if (open) {
			currentMode = mode;
			name = '';
			description = '';
			dueAt = '';
			startNow = false;
			selectedProjectId = prefillProjectId ?? prefillParentId ?? null;
			selectedParentId = prefillParentId ?? prefillProjectId ?? null;
			tasksApi.listProjectsFast().then((p) => projects = p);
		}
	});

	async function create() {
		if (!name.trim()) return;

		if (currentMode === 'task') {
			const created = await tasksApi.createTask({
				name: name.trim(),
				description: description || null,
				due_at: toISOString(dueAt),
				project_id: selectedProjectId
			});
			if (startNow) {
				await tasksApi.updateTask(created.id, { started_at: new Date().toISOString() });
			}
		} else {
			const created = await tasksApi.createProject({
				name: name.trim(),
				description: description || null,
				due_at: toISOString(dueAt),
				parent_id: selectedParentId
			});
			if (startNow) {
				await tasksApi.updateProject(created.id, { started_at: new Date().toISOString() });
			}
		}

		onclose();
		await invalidateAll();
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{currentMode === 'task' ? 'Nueva tarea' : 'Nuevo proyecto'}</h3>

	<div class="create-mode-toggle">
		<button class:active={currentMode === 'task'} onclick={() => currentMode = 'task'}>Tarea</button>
		<button class:active={currentMode === 'project'} onclick={() => currentMode = 'project'}>Proyecto</button>
	</div>

	<div class="detail-form">
		<div class="detail-field">
			<label for="create-name">Nombre</label>
			<input id="create-name" type="text" bind:value={name} onkeydown={(e) => e.key === 'Enter' && create()} />
		</div>
		<div class="detail-field">
			<label for="create-desc">Descripción</label>
			<textarea id="create-desc" bind:value={description} rows="2"></textarea>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field">
				<label for="create-due">Fecha límite</label>
				<input id="create-due" type="datetime-local" bind:value={dueAt} />
			</div>

			{#if currentMode === 'task'}
				<div class="detail-field" style="flex:1">
					<label for="create-project">Proyecto</label>
					<select id="create-project" bind:value={selectedProjectId}>
						<option value={null}>Sin proyecto</option>
						{#each projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="detail-field" style="flex:1">
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

		<button class="start-now-toggle" type="button" onclick={() => startNow = !startNow}>
			<div class="start-now-switch" class:active={startNow}>
				<div class="start-now-knob"></div>
			</div>
			Empezar ya
		</button>

		<div class="detail-actions">
			<button class="btn-primary" onclick={create}>Crear</button>
		</div>
	</div>
</BottomSheet>
