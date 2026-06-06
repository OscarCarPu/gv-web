import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import { toLocalDatetime, toISOString } from '$lib/shared/utils/datetime';
import type { ProjectDetailResponse } from '$lib/domains/tasks/types/Task.types';

export interface ProjectDetailApi {
	updateProject: (
		id: number,
		input: {
			name?: string | null;
			description?: string | null;
			due_at?: string | null;
			started_at?: string | null;
			finished_at?: string | null;
		}
	) => Promise<unknown>;
	deleteProject: (id: number) => Promise<void>;
}

/**
 * Owns the project detail page's mutation logic: hydrating the editable form from the
 * SSR `project`, save, the start/clear-start/finish lifecycle, and delete. Mirrors
 * `TaskTimer` / `TaskBoard`: injected `#api`, an injected `refresh` callback (the page
 * passes `invalidateAll` — kept OUT of this module so unit tests don't pull in
 * `$app/navigation`), named methods, and `$state` form fields bound by the template.
 *
 * Navigation on delete (`goto('/tasks')`) stays in the page, exactly as before.
 */
export class ProjectDetail {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: ProjectDetailApi;
	#refresh: () => Promise<void>;

	// The project currently loaded (set by `load`).
	#project = $state<ProjectDetailResponse | null>(null);

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');
	description = $state('');
	dueAt = $state('');

	saving = $state(false);

	constructor(refresh: () => Promise<void>, api: ProjectDetailApi = tasksApi) {
		this.#refresh = refresh;
		this.#api = api;
	}

	/** Hydrate the form from the SSR project (mirrors the page's previous `$effect`). */
	load(project: ProjectDetailResponse | null): void {
		this.#project = project;
		if (project) {
			this.name = project.name;
			this.description = project.description ?? '';
			this.dueAt = toLocalDatetime(project.due_at);
		}
	}

	async save(): Promise<void> {
		const project = this.#project;
		if (!project) return;
		this.saving = true;
		try {
			await this.#api.updateProject(project.id, {
				name: this.name,
				description: this.description || null,
				due_at: toISOString(this.dueAt),
			});
			addNotification('Project updated', 'success');
			await this.#refresh();
		} catch {
			addToast('Error saving project', 'error');
		} finally {
			this.saving = false;
		}
	}

	async setStarted(): Promise<void> {
		const project = this.#project;
		if (!project) return;
		const id = project.id;
		const now = new Date().toISOString();
		addNotification('Project started', 'success');
		try {
			await this.#api.updateProject(id, { started_at: now });
			await this.#refresh();
		} catch {
			addToast('Error starting project', 'error');
		}
	}

	async clearStarted(): Promise<void> {
		const project = this.#project;
		if (!project) return;
		const id = project.id;
		addNotification('Start removed', 'success');
		try {
			await this.#api.updateProject(id, { started_at: null });
			await this.#refresh();
		} catch {
			addToast('Error removing start', 'error');
		}
	}

	async setFinished(): Promise<void> {
		const project = this.#project;
		if (!project) return;
		const id = project.id;
		const now = new Date().toISOString();
		addNotification('Project finished', 'success');
		try {
			await this.#api.updateProject(id, { finished_at: now });
			await this.#refresh();
		} catch {
			addToast('Error finishing project', 'error');
		}
	}

	/**
	 * Delete the project. The caller is responsible for navigating away
	 * (`goto('/tasks')`) before/around this, exactly as the page did.
	 */
	async remove(): Promise<void> {
		const project = this.#project;
		if (!project) return;
		const id = project.id;
		addNotification('Project deleted', 'success');
		try {
			await this.#api.deleteProject(id);
			await this.#refresh();
		} catch {
			addToast('Error deleting project', 'error');
			await this.#refresh();
		}
	}
}
