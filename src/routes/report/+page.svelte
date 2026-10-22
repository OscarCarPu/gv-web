<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ReportStatus } from '$lib/domains/report/api/report.schemas';
	import { ReportScreen } from '$lib/domains/report/reportScreen.svelte';
	import ReportCard from '$lib/domains/report/components/ReportCard.svelte';
	import { groupItems } from '$lib/domains/report/utils/rowTitle';

	let { data }: { data: { status: ReportStatus | null } } = $props();

	// SSR status is a seed; the screen owns it from here on.
	// svelte-ignore state_referenced_locally
	const screen = new ReportScreen(data.status);
	const groups = $derived(groupItems(screen.items));

	onMount(() => {
		screen.start();
		return () => screen.stop();
	});

	async function dismiss() {
		if (await screen.dismiss()) await goto('/tasks', { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Report</title>
</svelte:head>

<section class="report-page">
	{#if screen.view === 'report'}
		<h1>What home had besides</h1>
		<p class="report-lead">
			The data of the backup server was restored as it is. These are the changes made at home that
			it does not hold; add again the ones you need.
		</p>
		{#if screen.reportError}
			<p class="report-error">The comparison could not be completed: {screen.reportError}</p>
		{/if}
		{#if screen.skipped.length > 0}
			<p class="report-lead">Not compared, they have no key: {screen.skipped.join(', ')}.</p>
		{/if}

		{#each groups as group (group.table)}
			<h2 class="report-group">
				{group.label}
				<span class="report-count">{group.items.length}</span>
			</h2>
			{#each group.items as item (`${item.table}:${item.key}`)}
				<ReportCard {item} />
			{/each}
		{/each}

		<div class="report-actions">
			<button type="button" class="btn-primary" disabled={screen.busy} onclick={dismiss}>
				Dismiss the report
			</button>
		</div>
	{:else if screen.view === 'none'}
		<h1>Nothing to review</h1>
		<a class="btn-primary" href="/tasks">Continue</a>
	{:else if screen.view === 'failed'}
		<h1>The restore failed</h1>
		<p class="report-error">{screen.error ?? 'Unknown error'}</p>
	{:else if screen.view === 'running'}
		<h1>Restoring your data</h1>
		<p>Bringing back the data of the backup server. This takes a moment.</p>
	{:else}
		<h1>The backup server is in charge</h1>
		<p>
			Home is back but the backup server still holds the latest data. The app opens once it has been
			restored.
		</p>
	{/if}
</section>
