<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import { formatTime, formatDateShort, formatDateFull } from '$lib/shared/utils/datetime';
	import DatetimePicker from '$lib/shared/components/DatetimePicker.svelte';
	import TaskBottomSheet from '$lib/domains/tasks/components/TaskBottomSheet.svelte';
	import CreateBottomSheet from '$lib/domains/tasks/components/CreateBottomSheet.svelte';
	import DepBadges from '$lib/domains/tasks/components/DepBadges.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { ProjectDetail } from '$lib/domains/tasks/projectDetail.svelte';

	let { data } = $props();

	let project = $derived(data.projectChildren?.project ?? null);
	let children = $derived(data.projectChildren?.children ?? []);

	const detail = new ProjectDetail(invalidateAll);

	const taskParam = page.url.searchParams.get('task');
	let selectedTaskId = $state<number | null>(taskParam ? Number(taskParam) : null);
	let showCreate = $state(false);
	let createMode = $state<'task' | 'project'>('task');

	$effect(() => {
		detail.load(project);
	});

	function remove() {
		if (!project) return;
		goto('/tasks');
		detail.remove();
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

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && !selectedTaskId && !showCreate) {
			e.preventDefault();
			goto('/tasks');
		}
	}}
/>

<svelte:head>
	<title>{project?.name ?? 'Project'}</title>
</svelte:head>

<div class="container">
	<div class="project-nav">
		<a href="/tasks" class="back-link">
			<Icon name="arrow-left" />
			Tasks
		</a>
		{#if project?.parent_id}
			<a href="/tasks/projects/{project.parent_id}" class="back-link">
				<Icon name="arrow-left" />
				Parent Project
			</a>
		{/if}
	</div>

	{#if project}
		<div class="project-detail-card">
			<div class="detail-form">
				<div class="detail-inline-row">
					<div class="detail-field flex-1">
						<label for="project-name">Name</label>
						<input id="project-name" type="text" bind:value={detail.name} maxlength={40} />
					</div>
					<div class="detail-field">
						<label for="dtp-project-due">Due date</label>
						<DatetimePicker bind:value={detail.dueAt} id="project-due" />
					</div>
				</div>
				<div class="detail-field">
					<label for="project-desc">Description</label>
					<textarea id="project-desc" bind:value={detail.description} rows="2"></textarea>
				</div>
				<div class="detail-info-row">
					<div class="detail-info-item">
						<span class="detail-info-label">Start</span>
						{#if project.started_at}
							<div class="detail-info-value-row">
								<span class="detail-info-value">{formatDateFull(project.started_at)}</span>
								<button
									class="value-clear-btn"
									onclick={() => detail.clearStarted()}
									title="Remove start"
								>
									<Icon name="xmark" />
								</button>
							</div>
						{:else}
							<button class="btn-action-sm btn-start" onclick={() => detail.setStarted()}
								>Start</button
							>
						{/if}
					</div>
					<div class="detail-info-item">
						<span class="detail-info-label">End</span>
						{#if project.finished_at}
							<span class="detail-info-value">{formatDateFull(project.finished_at)}</span>
						{:else}
							<button class="btn-action-sm" onclick={() => detail.setFinished()}>Finish</button>
						{/if}
					</div>
					{#if project.time_spent > 0}
						<div class="detail-info-item">
							<span class="detail-info-label">Time</span>
							<span class="detail-info-value">{formatTime(project.time_spent)}</span>
						</div>
					{/if}
				</div>

				<div class="detail-actions">
					<button class="btn-danger mr-auto" onclick={remove} disabled={detail.saving}
						>Delete</button
					>
					<button class="btn-primary" onclick={() => detail.save()} disabled={detail.saving}
						>Save</button
					>
				</div>
			</div>
		</div>

		<div class="project-children-section">
			<div class="project-children-header">
				<h2>Children</h2>
				<div class="project-children-actions">
					<button class="btn-primary btn-sm" onclick={openCreateTask}>
						<Icon name="plus" /> Task
					</button>
					<button class="btn-primary btn-sm" onclick={openCreateSubproject}>
						<Icon name="plus" /> Sub-project
					</button>
				</div>
			</div>

			{#if children.length === 0}
				<div class="project-children-empty">No children</div>
			{:else}
				<div class="project-children-list">
					{#each children as child (child.id + '-' + child.type)}
						{#if child.type === 'project'}
							<a href="/tasks/projects/{child.id}" class="project-child-row">
								<Icon name="folder" class="tree-folder-icon" />
								<span class="child-name">{child.name}</span>
								{#if child.due_at}
									<span class="child-due"
										><Icon name="calendar" /> {formatDateShort(child.due_at)}</span
									>
								{/if}
								{#if child.time_spent > 0}
									<span class="child-time"
										><Icon name="clock" /> {formatTime(child.time_spent)}</span
									>
								{/if}
								<span
									class="status-badge"
									class:started={child.started_at != null}
									class:finished={child.finished_at != null}
								>
									{child.finished_at ? 'Completed' : child.started_at ? 'In progress' : 'Pending'}
								</span>
								<Icon name="chevron-right" class="child-chevron" />
							</a>
						{:else}
							<div class="project-child-task-wrapper">
								<button class="project-child-row" onclick={() => (selectedTaskId = child.id)}>
									<Icon name="check-circle" class="child-task-icon" />
									<span class="child-name">{child.name}</span>
									{#if child.blocked}
										<Icon name="ban" class="blocked-icon" title="Blocked" />
									{/if}
									{#if child.depends_on?.length}
										<DepBadges
											deps={child.depends_on}
											ondetail={(id) => {
												selectedTaskId = id;
											}}
										/>
									{/if}
									{#if child.due_at}
										<span class="child-due"
											><Icon name="calendar" /> {formatDateShort(child.due_at)}</span
										>
									{/if}
									{#if child.time_spent > 0}
										<span class="child-time"
											><Icon name="clock" /> {formatTime(child.time_spent)}</span
										>
									{/if}
									<span
										class="status-badge"
										class:started={child.started_at != null && child.task_type === 'standard'}
										class:continuous={child.started_at != null && child.task_type === 'continuous'}
										class:recurring={child.started_at != null && child.task_type === 'recurring'}
										class:finished={child.finished_at != null}
									>
										{child.finished_at
											? 'Completed'
											: getStatusLabel(child.started_at, child.task_type, child.recurrence)}
									</span>
									{#if child.priority && child.priority <= 2}
										<span
											class="priority-badge"
											class:p-1={child.priority === 1}
											class:p-2={child.priority === 2}
										>
											P{child.priority}
										</span>
									{/if}
								</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="project-children-empty">Project not found</div>
	{/if}
</div>

<TaskBottomSheet taskId={selectedTaskId} onclose={() => (selectedTaskId = null)} />
<CreateBottomSheet
	open={showCreate}
	onclose={() => (showCreate = false)}
	mode={createMode}
	prefillProjectId={createMode === 'task' ? project?.id : null}
	prefillParentId={createMode === 'project' ? project?.id : null}
/>
