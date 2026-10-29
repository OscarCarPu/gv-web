<script lang="ts">
	import { PrinterHistoryController } from './printerHistory.svelte';
	import { formatEta } from './format';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	// svelte-ignore state_referenced_locally
	const controller = new PrinterHistoryController(id);

	$effect(() => {
		controller.start();
		return () => controller.stop();
	});

	function outcome(state: string): { label: string; cls: string } {
		switch (state) {
			case 'PRINTING':
				return { label: 'Printing', cls: 'is-printing' };
			case 'FIN_OK':
				return { label: 'Finished', cls: 'is-done' };
			case 'FIN_ERROR':
				return { label: 'Failed', cls: 'is-error' };
			case 'FIN_STOPPED':
				return { label: 'Stopped', cls: 'is-paused' };
			default:
				return { label: 'Unknown', cls: 'is-idle' };
		}
	}
</script>

<div class="printer-history">
	<div class="files-head">
		<h3>Recent prints</h3>
	</div>

	{#if controller.loading}
		<p class="files-empty">Loading history…</p>
	{:else if controller.error}
		<p class="files-empty">History unavailable: {controller.error}</p>
	{:else if controller.jobs.length === 0}
		<p class="files-empty">No prints yet.</p>
	{:else}
		<ul class="history-list">
			{#each controller.jobs as job, i (i)}
				{@const o = outcome(job.state)}
				<li class="history-item">
					<div class="history-main">
						<span class="file-name">{job.fileName || 'Deleted file'}</span>
						<span class="file-size">
							{job.material || '—'} · {job.timePrinting != null ? formatEta(job.timePrinting) : '—'}
						</span>
					</div>
					<span class="state-badge {o.cls}">{o.label}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
