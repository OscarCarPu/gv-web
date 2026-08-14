<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$shared/components/Icon.svelte';
	import Modal from '$shared/components/Modal.svelte';
	import { formatDateFull } from '$shared/utils/datetime';
	import { formatBytes, formatClock } from './format';
	import type { PrinterRecordingsController } from './printerRecordings.svelte';
	import type { Recording } from './api/printers.schemas';

	interface Props {
		id: string;
		/** Owned by PrinterPanel so the camera tile can show the REC badge from the same state. */
		controller: PrinterRecordingsController;
	}

	let { id, controller }: Props = $props();

	let expanded = $state(false);
	let playing = $state<Recording | null>(null);

	const FOLD_AT = 6;

	// The server is polled every few seconds; the elapsed clock has to move every second, so it is
	// derived from the recording's start time against a local ticker instead of from the poll.
	let now = $state(Date.now());
	$effect(() => {
		if (!controller.isRecording) return;
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const active = $derived(controller.active);
	const elapsed = $derived(active ? formatClock(now - new Date(active.startedAt).getTime()) : '');

	const saved = $derived(controller.recordings.filter((r) => !r.recording));
	const visible = $derived(expanded ? saved : saved.slice(0, FOLD_AT));
	const hidden = $derived(Math.max(0, saved.length - FOLD_AT));

	function fileUrl(name: string): string {
		return resolve('/domotics/printers/[id]/recordings/[name]', { id, name });
	}

	function poster(r: Recording): string | undefined {
		return r.poster ? fileUrl(r.poster) : undefined;
	}

	/**
	 * Name the file is saved under. The `download` attribute settles this client-side, so the
	 * links stay plain resolved routes — the server's `?download=1` is for direct URLs only.
	 */
	function downloadName(r: Recording): string {
		return `${id}_${r.name}`;
	}
</script>

<div class="printer-recordings">
	<div class="files-head">
		<h3>Recordings</h3>
		{#if controller.maxBytes > 0}
			<span class="files-space">
				{formatBytes(controller.usedBytes)} of {formatBytes(controller.maxBytes)}
			</span>
		{/if}
	</div>

	{#if active}
		<div class="rec-active">
			<span class="rec-dot" aria-hidden="true"></span>
			<div class="rec-active-info">
				<span class="file-name">Recording…</span>
				<span class="upload-status">
					{elapsed} · {formatBytes(active.sizeBytes)}
				</span>
			</div>
			<button
				class="btn-inline rec-stop"
				disabled={controller.busy}
				onclick={() => controller.stopRecording()}
			>
				<Icon name="stop" />
				Stop
			</button>
		</div>
	{:else}
		<button
			class="rec-start"
			disabled={controller.busy}
			onclick={() => controller.startRecording()}
		>
			<Icon name="circle" class="rec-start-icon" />
			<span>Record camera</span>
			<span class="rec-start-hint">Runs on the server — keeps going with this page closed</span>
		</button>
	{/if}

	{#if controller.loading}
		<p class="files-empty">Loading recordings…</p>
	{:else if controller.error}
		<p class="files-empty">Recordings unavailable: {controller.error}</p>
	{:else if saved.length === 0}
		<p class="files-empty">No saved recordings yet.</p>
	{:else}
		<ul class="rec-list">
			{#each visible as r (r.name)}
				<li class="rec-item" class:is-busy={controller.deleting === r.name}>
					<button
						class="rec-thumb"
						onclick={() => (playing = r)}
						aria-label="Play recording from {formatDateFull(r.startedAt)}"
					>
						{#if poster(r)}
							<img src={poster(r)} alt="" />
						{/if}
						<span class="rec-thumb-play"><Icon name="play" /></span>
						<span class="rec-thumb-time">{formatClock(r.durationMs)}</span>
					</button>
					<div class="rec-meta">
						<span class="file-name">{formatDateFull(r.startedAt)}</span>
						<div class="rec-meta-row">
							<span class="file-size">{formatBytes(r.sizeBytes)}</span>
							<div class="file-actions">
								<a
									class="btn-icon"
									href={resolve('/domotics/printers/[id]/recordings/[name]', { id, name: r.name })}
									download={downloadName(r)}
									title="Download"
									aria-label="Download recording from {formatDateFull(r.startedAt)}"
								>
									<Icon name="download" />
								</a>
								<button
									class="btn-icon"
									title="Delete"
									aria-label="Delete recording from {formatDateFull(r.startedAt)}"
									disabled={controller.deleting !== null}
									onclick={() => controller.remove(r.name)}
								>
									<Icon name="trash" />
								</button>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>

		{#if hidden > 0 && !expanded}
			<button class="files-more-btn" onclick={() => (expanded = true)}>
				Show {hidden} more
			</button>
		{:else if expanded && saved.length > FOLD_AT}
			<button class="files-more-btn" onclick={() => (expanded = false)}>Show less</button>
		{/if}
	{/if}
</div>

<Modal open={playing !== null} wide onclose={() => (playing = null)}>
	{#if playing}
		<div class="rec-player">
			<div class="rec-player-head">
				<h3>{formatDateFull(playing.startedAt)}</h3>
				<span class="files-space">
					{formatClock(playing.durationMs)} · {formatBytes(playing.sizeBytes)}
				</span>
			</div>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video src={fileUrl(playing.name)} poster={poster(playing)} controls autoplay playsinline
			></video>
			<div class="rec-player-actions">
				<a
					class="btn-inline"
					href={resolve('/domotics/printers/[id]/recordings/[name]', { id, name: playing.name })}
					download={downloadName(playing)}
				>
					Download
				</a>
				<button class="btn-inline" onclick={() => (playing = null)}>Close</button>
			</div>
		</div>
	{/if}
</Modal>
