<script lang="ts">
	import { Popover } from 'flowbite-svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import Icon from '$lib/shared/components/Icon.svelte';

	interface Props {
		/** CSS selector for the element(s) that open this picker */
		trigger: string;
		onselect: (task: TaskListItem) => void;
		currentTaskId?: number | null;
		onopendetail?: () => void;
	}

	let { trigger, onselect, currentTaskId = null, onopendetail }: Props = $props();

	let open = $state(false);
	let loaded = $state(false);
	let tasks = $state<TaskListItem[]>([]);
	let query = $state('');
	let failed = $state(false);
	let searchInput = $state<HTMLInputElement | null>(null);

	// `list-fast` already scopes to unfinished tasks in active projects
	// (started_at IS NOT NULL AND finished_at IS NULL), so no extra filtering here.
	$effect(() => {
		if (!open) return;
		if (!loaded) {
			loaded = true;
			failed = false;
			tasksApi
				.listTasksFast()
				.then((t) => (tasks = t))
				.catch(() => {
					// Without this the picker renders a failed load as "No tasks", which
					// reads like an empty account rather than a broken request.
					failed = true;
					loaded = false;
				});
		}
		searchInput?.focus();
	});

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return tasks;
		return tasks.filter((t) => t.name.toLowerCase().includes(q));
	});

	interface Group {
		label: string;
		tasks: TaskListItem[];
	}

	const grouped = $derived.by((): Group[] => {
		const map = new Map<number | null, Group>();
		for (const t of filtered) {
			const key = t.project_id;
			if (!map.has(key)) map.set(key, { label: t.project_name ?? 'No project', tasks: [] });
			map.get(key)!.tasks.push(t);
		}
		return [...map.values()];
	});

	function pick(task: TaskListItem) {
		onselect(task);
		open = false;
		query = '';
	}

	function openDetail() {
		open = false;
		onopendetail?.();
	}
</script>

<Popover
	triggeredBy={trigger}
	trigger="click"
	bind:isOpen={open}
	arrow={false}
	class="timer-task-picker"
>
	<div class="ttp-body">
		{#if currentTaskId && onopendetail}
			<button type="button" class="ttp-detail" onclick={openDetail}>
				<Icon name="pen" /> Open details
			</button>
		{/if}
		<input
			bind:this={searchInput}
			class="ttp-search"
			type="text"
			placeholder="Search tasks..."
			bind:value={query}
		/>
		<div class="ttp-list">
			{#if failed}
				<p class="ttp-empty">Could not load tasks</p>
			{:else if grouped.length === 0}
				<p class="ttp-empty">No tasks</p>
			{:else}
				{#each grouped as g (g.label)}
					<div class="ttp-group-label">{g.label}</div>
					{#each g.tasks as t (t.id)}
						<button
							type="button"
							class="ttp-item"
							class:current={t.id === currentTaskId}
							onclick={() => pick(t)}
						>
							{t.name}
						</button>
					{/each}
				{/each}
			{/if}
		</div>
	</div>
</Popover>
