<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$shared/components/Icon.svelte';
	import { ACCEPT_ATTR, PrinterFilesController, type Upload } from './printerFiles.svelte';

	interface Props {
		id: string;
		/** Telemetry reachability, so the panel and the drop zone agree when the printer is down. */
		online: boolean;
	}

	let { id, online }: Props = $props();

	const controller = new PrinterFilesController(id);

	let dragging = $state(false);
	let expanded = $state(false);
	let input: HTMLInputElement | null = $state(null);

	const FOLD_AT = 15;

	$effect(() => {
		controller.start();

		// Without this, a file dropped slightly off-target makes the browser navigate away from
		// the page and open the gcode instead.
		const swallow = (e: DragEvent) => e.preventDefault();
		window.addEventListener('dragover', swallow);
		window.addEventListener('drop', swallow);

		return () => {
			controller.stop();
			window.removeEventListener('dragover', swallow);
			window.removeEventListener('drop', swallow);
		};
	});

	onDestroy(() => controller.stop());

	const blocked = $derived(!online ? 'PrusaLink unreachable' : controller.blockedReason);
	const enabled = $derived(blocked === null);

	const visible = $derived(expanded ? controller.files : controller.files.slice(0, FOLD_AT));
	const hidden = $derived(Math.max(0, controller.files.length - FOLD_AT));

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (!enabled) return;
		const files = e.dataTransfer?.files;
		if (files?.length) controller.addFiles(files);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (enabled) dragging = true;
	}

	function onDragLeave(e: DragEvent) {
		// Ignore transitions between the zone's own children.
		if (e.currentTarget instanceof Node && e.relatedTarget instanceof Node) {
			if (e.currentTarget.contains(e.relatedTarget)) return;
		}
		dragging = false;
	}

	function pick() {
		if (enabled) input?.click();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			pick();
		}
	}

	function onPicked(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		if (target.files?.length) controller.addFiles(target.files);
		target.value = ''; // let the same file be picked again
	}

	function size(bytes?: number): string {
		if (bytes == null) return '—';
		if (bytes < 1024) return `${bytes} B`;
		const mb = bytes / (1024 * 1024);
		if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
		if (mb < 1024) return `${mb.toFixed(1)} MB`;
		return `${(mb / 1024).toFixed(2)} GB`;
	}

	function uploadPct(u: Upload): number {
		if (u.status === 'done') return 100;
		if (!u.size) return 0;
		return Math.min(100, Math.round((u.sent / u.size) * 100));
	}

	function uploadLabel(u: Upload): string {
		if (u.status === 'sending') return 'Sending to printer…';
		if (u.status === 'done') return 'Uploaded';
		if (u.status === 'conflict') return u.error ?? 'Already on the printer';
		if (u.status === 'error') return u.error ?? 'Upload failed';
		return `${uploadPct(u)}% · ${size(u.sent)} of ${size(u.size)}`;
	}
</script>

<div class="printer-files">
	<div class="files-head">
		<h3>Print files</h3>
		{#if controller.storage?.freeSpace != null && controller.storage.available !== false}
			<span class="files-space">{size(controller.storage.freeSpace)} free</span>
		{/if}
	</div>

	<div
		class="dropzone"
		class:is-dragging={dragging}
		class:is-disabled={!enabled}
		role="button"
		tabindex={enabled ? 0 : -1}
		aria-disabled={!enabled}
		aria-label="Upload a print file"
		ondragover={onDragOver}
		ondragenter={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
		onclick={pick}
		onkeydown={onKeydown}
	>
		<Icon name="folder" class="dropzone-icon" />
		{#if enabled}
			<p class="dropzone-title">Drop a print file here</p>
			<p class="dropzone-hint">or click to browse · .bgcode, .gcode, .gco, .g</p>
		{:else}
			<p class="dropzone-title">Uploads unavailable</p>
			<p class="dropzone-hint">{blocked}</p>
		{/if}
	</div>

	<input
		bind:this={input}
		type="file"
		class="dropzone-input"
		accept={ACCEPT_ATTR}
		multiple
		onchange={onPicked}
	/>

	{#each controller.uploads as u (u.id)}
		<div class="upload-row" class:is-error={u.status === 'error' || u.status === 'conflict'}>
			<div class="upload-info">
				<span class="file-name">{u.name}</span>
				<span class="upload-status">{uploadLabel(u)}</span>
			</div>

			{#if u.status === 'uploading' || u.status === 'sending' || u.status === 'done'}
				<div class="progress upload-progress">
					<div class="progress-bar" style="width: {uploadPct(u)}%"></div>
					<span class="progress-label">{uploadPct(u)}%</span>
				</div>
			{/if}

			<div class="file-actions">
				{#if u.status === 'conflict'}
					<button class="btn-inline" onclick={() => controller.replace(u)}>Replace</button>
				{:else if u.status === 'error'}
					<button
						class="btn-icon"
						title="Retry"
						aria-label="Retry {u.name}"
						onclick={() => controller.retry(u)}
					>
						<Icon name="rotate-left" />
					</button>
				{:else if u.status === 'uploading' || u.status === 'sending'}
					<button
						class="btn-icon"
						title="Cancel"
						aria-label="Cancel {u.name}"
						onclick={() => controller.cancel(u)}
					>
						<Icon name="xmark" />
					</button>
				{/if}
				{#if u.status === 'error' || u.status === 'conflict'}
					<button
						class="btn-icon"
						title="Dismiss"
						aria-label="Dismiss {u.name}"
						onclick={() => controller.dismiss(u.id)}
					>
						<Icon name="xmark" />
					</button>
				{/if}
			</div>
		</div>
	{/each}

	{#if controller.loading}
		<p class="files-empty">Loading files…</p>
	{:else if !controller.online}
		<p class="files-empty">Files unavailable while PrusaLink is unreachable.</p>
	{:else if controller.files.length === 0}
		<p class="files-empty">No files on the printer.</p>
	{:else}
		<ul class="file-list">
			{#each visible as f (f.name)}
				<li class="file-row" class:is-busy={controller.busy === f.name}>
					<span class="file-name">{f.displayName}</span>
					<span class="file-size">{size(f.size)}</span>
					<span class="file-actions">
						<button
							class="btn-icon"
							title="Print"
							aria-label="Print {f.displayName}"
							disabled={controller.busy !== null}
							onclick={() => controller.print(f.name)}
						>
							<Icon name="play" />
						</button>
						<button
							class="btn-icon"
							title="Delete"
							aria-label="Delete {f.displayName}"
							disabled={controller.busy !== null || f.readOnly === true}
							onclick={() => controller.remove(f.name)}
						>
							<Icon name="trash" />
						</button>
					</span>
				</li>
			{/each}
		</ul>

		{#if hidden > 0 && !expanded}
			<button class="files-more-btn" onclick={() => (expanded = true)}>
				Show {hidden} more
			</button>
		{:else if expanded && controller.files.length > FOLD_AT}
			<button class="files-more-btn" onclick={() => (expanded = false)}>Show less</button>
		{/if}
	{/if}
</div>
