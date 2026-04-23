<script lang="ts">
	import type { ActiveTreeNode } from '$lib/domains/tasks/types/Task.types';
	import { getStatusLabel } from '$lib/domains/tasks/utils/statusLabel';
	import TreeNodeItem from './TreeNodeItem.svelte';
	import DepBadges from './DepBadges.svelte';
	import { linkify } from '$shared/utils/linkify';
	import { getContext } from 'svelte';

	interface Props {
		node: ActiveTreeNode;
		parentProjectName?: string;
		parentProjectDueAt?: string | null;
		onstart?: (taskId: number, taskName: string, projectName?: string) => void;
		ontoggle?: (id: number, type: 'project' | 'task', action: 'start' | 'finish') => void;
		ondetail?: (id: number, type: 'project' | 'task') => void;
		oncreatetask?: (projectId: number) => void;
		isTimerRunning?: boolean;
	}

	let {
		node,
		parentProjectName,
		parentProjectDueAt,
		onstart,
		ontoggle,
		ondetail,
		oncreatetask,
		isTimerRunning = false,
	}: Props = $props();

	const { isExpanded, toggle, formatDate } = getContext<{
		isExpanded: (id: number) => boolean;
		toggle: (id: number) => void;
		formatDate: (dateStr: string) => string;
	}>('tree-state');

	const isProject = $derived(node.type === 'project');
	const hasChildren = $derived(node.children != null && node.children.length > 0);
	const expanded = $derived(isExpanded(node.id));
	const isStarted = $derived(node.started_at != null);
	const statusLabel = $derived(getStatusLabel(node.started_at, node.task_type, node.recurrence));
</script>

{#if isProject}
	<div class="tree-project-wrapper">
		<div class="tree-project-row">
			{#if hasChildren}
				<button class="tree-chevron-btn" onclick={() => toggle(node.id)} aria-label="Expandir">
					<i class="fa-solid fa-chevron-right tree-chevron" class:expanded></i>
				</button>
			{/if}
			<i class="fa-solid fa-folder tree-folder-icon"></i>
			<button class="task-name-btn" onclick={() => ondetail?.(node.id, 'project')}
				>{node.name}</button
			>
			{#if node.due_at}
				<span class="tree-project-due"
					><i class="fa-regular fa-calendar"></i> {formatDate(node.due_at)}</span
				>
			{/if}
		</div>
		<button class="btn-primary btn-sm" onclick={() => oncreatetask?.(node.id)} title="Agregar tarea"
			><i class="fa-solid fa-plus"></i></button
		>
		<button class="btn-primary btn-sm" onclick={() => ontoggle?.(node.id, 'project', 'finish')}
			>Acabar</button
		>
	</div>

	{#if expanded && hasChildren}
		<div class="tree-children">
			{#each node.children! as child (`${child.type}-${child.id}`)}
				<TreeNodeItem
					node={child}
					parentProjectName={node.name}
					parentProjectDueAt={node.due_at}
					{onstart}
					{ontoggle}
					{ondetail}
					{oncreatetask}
					{isTimerRunning}
				/>
			{/each}
		</div>
	{/if}
{:else}
	<div class="task-item">
		<div class="task-info">
			<div class="task-name-row">
				<button class="task-name-btn" onclick={() => ondetail?.(node.id, 'task')}
					>{node.name}</button
				>
				{#if node.blocked}
					<i class="fa-solid fa-ban blocked-icon" title="Bloqueada"></i>
				{/if}
			</div>
			{#if node.depends_on?.length}
				<DepBadges deps={node.depends_on} ondetail={(id) => ondetail?.(id, 'task')} />
			{/if}
			{#if parentProjectName}
				<span class="task-project">
					{parentProjectName}
					{#if parentProjectDueAt}
						<span class="task-project-due"
							><i class="fa-regular fa-calendar"></i> {formatDate(parentProjectDueAt)}</span
						>
					{/if}
				</span>
			{/if}
			{#if node.description}
				<span class="task-description">{@html linkify(node.description)}</span>
			{/if}
			<div class="task-meta">
				<span
					class="status-badge"
					class:started={isStarted && node.task_type === 'standard'}
					class:continuous={node.task_type === 'continuous' && isStarted}
					class:recurring={node.task_type === 'recurring' && isStarted}
				>
					{statusLabel}
				</span>
				{#if node.priority != null}
					<span class="priority-badge p-{node.priority}">P{node.priority}</span>
				{/if}
				{#if node.due_at}
					<span class="task-due"
						><i class="fa-regular fa-calendar"></i> {formatDate(node.due_at)}</span
					>
				{/if}
			</div>
		</div>
		<div class="task-actions">
			{#if isStarted}
				<button
					class="btn-primary btn-sm"
					onclick={() => ontoggle?.(node.id, 'task', 'finish')}
					disabled={node.blocked}>{node.task_type === 'recurring' ? 'Renovar' : 'Acabar'}</button
				>
			{:else}
				<button
					class="btn-primary btn-start btn-sm"
					onclick={() => ontoggle?.(node.id, 'task', 'start')}
					disabled={node.blocked}>Empezar</button
				>
			{/if}
			<button
				class="btn-primary"
				onclick={() => onstart?.(node.id, node.name, parentProjectName)}
				disabled={node.blocked}
			>
				<i class="fa-solid {isTimerRunning ? 'fa-arrow-right' : 'fa-play'}"></i>
				{isTimerRunning ? 'Asignar' : 'Iniciar'}
			</button>
		</div>
	</div>
{/if}
