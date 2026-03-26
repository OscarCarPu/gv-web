<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { toLocalDatetime, toISOString, formatTime, formatDateShort, formatDateFull } from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import TaskBottomSheet from '$lib/domains/tasks/components/TaskBottomSheet.svelte';
	import CreateBottomSheet from '$lib/domains/tasks/components/CreateBottomSheet.svelte';
	import { addToast } from '$lib/shared/stores/toast.svelte';

	let { data } = $props();

	let project = $derived(data.projectChildren?.project ?? null);
	let children = $derived(data.projectChildren?.children ?? []);

	let name = $state('');
	let description = $state('');
	let dueAt = $state('');

	let selectedTaskId = $state<number | null>(null);
	let showCreate = $state(false);
	let createMode = $state<'task' | 'project'>('task');
	let saving = $state(false);

	$effect(() => {
		if (project) {
			name = project.name;
			description = project.description ?? '';
			dueAt = toLocalDatetime(project.due_at);
		}
	});

	async function save() {
		if (!project) return;
		saving = true;
		try {
			await tasksApi.updateProject(project.id, {
				name,
				description: description || null,
				due_at: toISOString(dueAt)
			});
			await invalidateAll();
		} catch {
			addToast('Error al guardar proyecto', 'error');
		} finally {
			saving = false;
		}
	}

	async function setStarted() {
		if (!project) return;
		try {
			await tasksApi.updateProject(project.id, { started_at: new Date().toISOString() });
			await invalidateAll();
		} catch {
			addToast('Error al iniciar proyecto', 'error');
		}
	}

	async function setFinished() {
		if (!project) return;
		try {
			await tasksApi.updateProject(project.id, { finished_at: new Date().toISOString() });
			await invalidateAll();
		} catch {
			addToast('Error al finalizar proyecto', 'error');
		}
	}

	async function remove() {
		if (!project) return;
		saving = true;
		try {
			await tasksApi.deleteProject(project.id);
			await invalidateAll();
			goto('/tasks');
		} catch {
			addToast('Error al eliminar proyecto', 'error');
		} finally {
			saving = false;
		}
	}

	function openCreateTask() {
		createMode = 'task';
		showCreate = true;
	}

	function openCreateSubproject() {
		createMode = 'project';
		showCreate = true;
	}
</script>

<svelte:window onkeydown={(e) => {
	if (e.key === 'Escape' && !selectedTaskId && !showCreate) {
		e.preventDefault();
		goto('/tasks');
	}
}} />

<svelte:head>
	<title>{project?.name ?? 'Proyecto'}</title>
</svelte:head>

<div class="container">
	<div class="project-nav">
		<a href="/tasks" class="back-link">
			<i class="fa-solid fa-arrow-left"></i>
			Tareas
		</a>
		{#if project?.parent_id}
			<a href="/tasks/projects/{project.parent_id}" class="back-link">
				<i class="fa-solid fa-arrow-left"></i>
				Proyecto padre
			</a>
		{/if}
	</div>

	{#if project}
		<div class="project-detail-card">
			<div class="detail-form">
				<div class="detail-inline-row">
					<div class="detail-field flex-1">
						<label for="project-name">Nombre</label>
						<input id="project-name" type="text" bind:value={name} />
					</div>
					<div class="detail-field">
						<label for="dtp-project-due">Fecha límite</label>
						<DatetimePicker bind:value={dueAt} id="project-due" />
					</div>
				</div>
				<div class="detail-field">
					<label for="project-desc">Descripción</label>
					<textarea id="project-desc" bind:value={description} rows="2"></textarea>
				</div>
				<div class="detail-info-row">
					<div class="detail-info-item">
						<span class="detail-info-label">Inicio</span>
						{#if project.started_at}
							<span class="detail-info-value">{formatDateFull(project.started_at)}</span>
						{:else}
							<button class="btn-action-sm btn-start" onclick={setStarted}>Empezar</button>
						{/if}
					</div>
					<div class="detail-info-item">
						<span class="detail-info-label">Fin</span>
						{#if project.finished_at}
							<span class="detail-info-value">{formatDateFull(project.finished_at)}</span>
						{:else}
							<button class="btn-action-sm" onclick={setFinished}>Finalizar</button>
						{/if}
					</div>
					{#if project.time_spent > 0}
						<div class="detail-info-item">
							<span class="detail-info-label">Tiempo</span>
							<span class="detail-info-value">{formatTime(project.time_spent)}</span>
						</div>
					{/if}
				</div>

				<div class="detail-actions">
					<button class="btn-danger mr-auto" onclick={remove} disabled={saving}>Eliminar</button>
					<button class="btn-primary" onclick={save} disabled={saving}>Guardar</button>
				</div>
			</div>
		</div>

		<div class="project-children-section">
			<div class="project-children-header">
				<h2>Hijos</h2>
				<div class="project-children-actions">
					<button class="btn-primary btn-sm" onclick={openCreateTask}>
						<i class="fa-solid fa-plus"></i> Tarea
					</button>
					<button class="btn-primary btn-sm" onclick={openCreateSubproject}>
						<i class="fa-solid fa-plus"></i> Sub-proyecto
					</button>
				</div>
			</div>

			{#if children.length === 0}
				<div class="project-children-empty">Sin hijos</div>
			{:else}
				<div class="project-children-list">
					{#each children as child (child.id + '-' + child.type)}
						{#if child.type === 'project'}
							<a href="/tasks/projects/{child.id}" class="project-child-row">
								<i class="fa-solid fa-folder tree-folder-icon"></i>
								<span class="child-name">{child.name}</span>
								{#if child.due_at}
									<span class="child-due"><i class="fa-regular fa-calendar"></i> {formatDateShort(child.due_at)}</span>
								{/if}
								{#if child.time_spent > 0}
									<span class="child-time"><i class="fa-regular fa-clock"></i> {formatTime(child.time_spent)}</span>
								{/if}
								<span class="child-status" class:started={child.started_at != null} class:finished={child.finished_at != null}>
									{child.finished_at ? 'Completado' : child.started_at ? 'En progreso' : 'Pendiente'}
								</span>
								<i class="fa-solid fa-chevron-right child-chevron"></i>
							</a>
						{:else}
							<button class="project-child-row" onclick={() => selectedTaskId = child.id}>
								<i class="fa-solid fa-check-circle child-task-icon"></i>
								<span class="child-name">{child.name}</span>
								{#if child.due_at}
									<span class="child-due"><i class="fa-regular fa-calendar"></i> {formatDateShort(child.due_at)}</span>
								{/if}
								{#if child.time_spent > 0}
									<span class="child-time"><i class="fa-regular fa-clock"></i> {formatTime(child.time_spent)}</span>
								{/if}
								<span class="child-status" class:started={child.started_at != null} class:finished={child.finished_at != null}>
									{child.finished_at ? 'Completado' : child.started_at ? 'En progreso' : 'Pendiente'}
								</span>
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="project-children-empty">Proyecto no encontrado</div>
	{/if}
</div>

<TaskBottomSheet taskId={selectedTaskId} onclose={() => selectedTaskId = null} />
<CreateBottomSheet
	open={showCreate}
	onclose={() => showCreate = false}
	mode={createMode}
	prefillProjectId={createMode === 'task' ? project?.id : null}
	prefillParentId={createMode === 'project' ? project?.id : null}
/>
