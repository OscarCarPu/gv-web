<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { formatTime, formatDateFull } from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import DepSelector from './DepSelector.svelte';
	import { linkify } from '$shared/utils/linkify';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { TaskDetail } from '$lib/domains/tasks/taskDetail.svelte';
	import { untrack } from 'svelte';

	interface Props {
		taskId: number | null;
		onclose: () => void;
	}

	let { taskId, onclose }: Props = $props();

	const detail = new TaskDetail(undefined, {
		onclose: () => onclose(),
		refresh: invalidateAll,
	});

	// Reload only when the selected task changes. `load()` → `#loadTask()` reads and
	// writes reactive state (`#taskId`, `projects`), so tracking those reads would make
	// this effect re-run in a loop and re-hydrate the form (clobbering edits like `dueAt`
	// while the user is changing them). Depend solely on `taskId`.
	$effect(() => {
		const id = taskId;
		untrack(() => detail.load(id));
	});

	function goToProject() {
		if (detail.task?.project_id) {
			onclose();
			goto(`/tasks/projects/${detail.task.project_id}`);
		}
	}
</script>

<BottomSheet open={taskId != null && detail.task != null} {onclose} constrained>
	{#if detail.task}
		<div class="detail-title-row">
			{#if detail.task.project_id && detail.projectName}
				<button class="project-link-inline" onclick={goToProject}>
					<Icon name="folder" />
					{detail.projectName}
				</button>
			{/if}
			<h3 class="modal-title">Task details</h3>
		</div>

		<div class="detail-form">
			<div class="detail-inline-row">
				<div class="detail-field flex-1">
					<label for="task-name">Name</label>
					<input
						id="task-name"
						type="text"
						bind:value={detail.name}
						maxlength={40}
						class:field-error={detail.nameError}
						oninput={() => (detail.nameError = false)}
					/>
				</div>
				<div class="detail-field">
					<label for="dtp-task-due">Due date</label>
					<DatetimePicker bind:value={detail.dueAt} id="task-due" />
				</div>
				<div class="detail-field">
					<label for="task-project">Project</label>
					<select id="task-project" bind:value={detail.selectedProjectId}>
						<option value={null}>No project</option>
						{#each detail.projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
				<div class="detail-field">
					<label for="task-type">Type</label>
					<select id="task-type" bind:value={detail.taskType}>
						<option value="standard">Standard</option>
						<option value="continuous">Continuous</option>
						<option value="recurring">Recurring</option>
					</select>
				</div>
				{#if detail.taskType === 'recurring'}
					<div class="detail-field">
						<label for="task-recurrence">Every (days)</label>
						<input id="task-recurrence" type="number" min="1" bind:value={detail.recurrence} />
					</div>
				{/if}
				<div class="detail-field">
					<label for="task-priority">Priority</label>
					<select id="task-priority" bind:value={detail.priority}>
						<option value={1}>1 · Urgent</option>
						<option value={2}>2 · High</option>
						<option value={3}>3 · Medium</option>
						<option value={4}>4 · Low</option>
						<option value={5}>5 · Very low</option>
					</select>
				</div>
			</div>
			<div class="detail-field">
				<div class="detail-field-header">
					<label for="task-desc">Description</label>
					{#if detail.description && !detail.editingDescription}
						<button
							type="button"
							class="desc-edit-btn"
							onclick={() => (detail.editingDescription = true)}
							aria-label="Edit description"
						>
							<Icon name="pen" />
						</button>
					{/if}
				</div>
				{#if detail.editingDescription}
					<textarea
						id="task-desc"
						bind:value={detail.description}
						rows="2"
						onblur={() => {
							if (detail.description) detail.editingDescription = false;
						}}
					></textarea>
				{:else}
					<div class="desc-view">{@html linkify(detail.description)}</div>
				{/if}
			</div>

			<div class="detail-info-row">
				<div class="detail-info-item">
					<span class="detail-info-label">Start</span>
					{#if detail.task.started_at}
						<span class="detail-info-value">{formatDateFull(detail.task.started_at)}</span>
					{:else}
						<button class="btn-action-sm btn-start" onclick={() => detail.setStarted()}
							>Start</button
						>
					{/if}
				</div>
				<div class="detail-info-item">
					<span class="detail-info-label">End</span>
					{#if detail.task.finished_at}
						<span class="detail-info-value">{formatDateFull(detail.task.finished_at)}</span>
					{:else}
						<button class="btn-action-sm" onclick={() => detail.setFinished()}>Finish</button>
					{/if}
				</div>
				{#if detail.task.time_spent > 0}
					<div class="detail-info-item">
						<span class="detail-info-label">Time</span>
						<span class="detail-info-value">{formatTime(detail.task.time_spent)}</span>
					</div>
				{/if}
			</div>

			<div class="detail-inline-row">
				<div class="flex-1">
					<DepSelector
						selected={detail.dependsOn}
						onchange={(deps) => (detail.dependsOn = deps)}
						excludeId={taskId!}
						label="Depends on"
						projectId={detail.task?.project_id}
					/>
				</div>
				<div class="flex-1">
					<DepSelector
						selected={detail.blocks}
						onchange={(deps) => (detail.blocks = deps)}
						excludeId={taskId!}
						label="Blocks"
						projectId={detail.task?.project_id}
					/>
				</div>
			</div>

			<div class="detail-field">
				<span class="label text-text-muted text-sm font-medium">Todos</span>
				<div class="todo-list">
					{#each detail.todos as todo (todo.id)}
						<div class="todo-item">
							<input
								type="checkbox"
								checked={todo.is_done}
								onchange={() => detail.toggleTodo(todo)}
							/>
							<span class:line-through={todo.is_done}>{todo.name}</span>
							<button
								class="btn-danger btn-sm ml-auto"
								onclick={() => detail.deleteTodo(todo.id)}
								aria-label="Delete todo"
							>
								<Icon name="trash" />
							</button>
						</div>
					{/each}
				</div>
				<div class="todo-add">
					<input
						type="text"
						placeholder="New todo..."
						bind:value={detail.newTodoName}
						onkeydown={(e) => e.key === 'Enter' && detail.addTodo()}
					/>
					<button class="btn-primary btn-sm" onclick={() => detail.addTodo()}>Add</button>
				</div>
			</div>

			<div class="detail-actions">
				<button class="btn-danger mr-auto" onclick={() => detail.remove()} disabled={detail.saving}
					>Delete</button
				>
				<button class="btn-primary" onclick={() => detail.save()} disabled={detail.saving}
					>Save</button
				>
			</div>
		</div>
	{/if}
</BottomSheet>
