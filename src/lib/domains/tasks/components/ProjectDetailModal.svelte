<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/shared/components/Modal.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { ProjectDetailResponse } from '$lib/domains/tasks/types/Task.types';

	interface Props {
		projectId: number | null;
		onclose: () => void;
	}

	let { projectId, onclose }: Props = $props();

	let project = $state<ProjectDetailResponse | null>(null);
	let name = $state('');
	let description = $state('');
	let dueAt = $state('');

	function toLocalDatetime(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function toISOString(local: string): string | null {
		if (!local) return null;
		return new Date(local).toISOString();
	}

	$effect(() => {
		if (projectId != null) {
			tasksApi.getProject(projectId).then((p) => {
				project = p;
				name = p.name;
				description = p.description ?? '';
				dueAt = toLocalDatetime(p.due_at);
			});
		} else {
			project = null;
		}
	});

	async function save() {
		if (projectId == null) return;
		await tasksApi.updateProject(projectId, {
			name,
			description: description || null,
			due_at: toISOString(dueAt)
		});
		await invalidateAll();
		onclose();
	}

	async function remove() {
		if (projectId == null) return;
		await tasksApi.deleteProject(projectId);
		await invalidateAll();
		onclose();
	}
</script>

<Modal open={projectId != null && project != null} {onclose}>
	{#if project}
		<h2 class="modal-title">Detalle de proyecto</h2>
		<div class="detail-form">
			<div class="detail-field">
				<label for="project-name">Nombre</label>
				<input id="project-name" type="text" bind:value={name} />
			</div>
			<div class="detail-field">
				<label for="project-desc">Descripción</label>
				<textarea id="project-desc" bind:value={description} rows="3"></textarea>
			</div>
			<div class="detail-field">
				<label for="project-due">Fecha límite</label>
				<input id="project-due" type="datetime-local" bind:value={dueAt} />
			</div>

			<div class="detail-actions">
				<button class="btn-danger" onclick={remove}>Eliminar</button>
				<button class="btn-primary" onclick={save}>Guardar</button>
			</div>
		</div>
	{/if}
</Modal>
