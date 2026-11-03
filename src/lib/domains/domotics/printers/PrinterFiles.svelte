<script lang="ts">
	import { onDestroy } from 'svelte';
	import { apiUrl } from '$shared/api/client';
	import Icon from '$shared/components/Icon.svelte';
	import { formatBytes as size, formatEta, formatFilament } from './format';
	import {
		ACCEPT_ATTR,
		PrinterFilesController,
		type FileSortKey,
		type Upload,
	} from './printerFiles.svelte';
	import type { PrinterFile } from './api/printers.schemas';

	interface Props {
		id: string;
		/** Telemetry reachability, so the panel and the drop zone agree when the printer is down. */
		online: boolean;
	}

	let { id, online }: Props = $props();

	// Id is fixed for the panel this belongs to.
	// svelte-ignore state_referenced_locally
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

	onDestroy(() => {
		controller.stop();
		disarmDelete();
	});

	const blocked = $derived(!online ? 'PrusaLink unreachable' : controller.blockedReason);
	const enabled = $derived(blocked === null);

	const visible = $derived(expanded ? controller.shown : controller.shown.slice(0, FOLD_AT));
	const hidden = $derived(Math.max(0, controller.shown.length - FOLD_AT));

	const SORT_KEYS: { key: FileSortKey; label: string }[] = [
		{ key: 'name', label: 'Name' },
		{ key: 'date', label: 'Date' },
		{ key: 'size', label: 'Size' },
	];

	const dateFmt = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
	const timeFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

	// Bulk delete arms on the first click and runs on the second, like Stop print: no dialogs in
	// this app, but one stray click must not empty the printer's drive.
	let deleteArmed = $state(false);
	let deleteArmTimer: ReturnType<typeof setTimeout> | null = null;
	const DELETE_ARM_MS = 4000;

	function disarmDelete() {
		if (deleteArmTimer) clearTimeout(deleteArmTimer);
		deleteArmTimer = null;
		deleteArmed = false;
	}

	function onDeleteSelected() {
		if (!deleteArmed) {
			deleteArmed = true;
			deleteArmTimer = setTimeout(disarmDelete, DELETE_ARM_MS);
			return;
		}
		disarmDelete();
		void controller.removeSelected();
	}

	// A changed selection means a different thing to confirm; make the user arm it again.
	$effect(() => {
		void controller.selected.size;
		disarmDelete();
	});

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

	// Sequential legs: browser → gv-api (XHR progress), then gv-api → printer (polled); a rename
	// first reads the file off the printer. The bar shows whichever leg is currently running.
	function uploadPct(u: Upload): number {
		if (u.status === 'done') return 100;
		if (!u.size) return 0;
		const bytes = u.status === 'sending' || u.status === 'reading' ? u.forwarded : u.sent;
		return Math.min(100, Math.round((bytes / u.size) * 100));
	}

	function uploadLabel(u: Upload): string {
		const left = u.etaSeconds != null ? ` · ${formatEta(u.etaSeconds)} left` : '';
		switch (u.status) {
			case 'queued':
				return 'Waiting for the previous upload';
			case 'waiting':
				return 'Queued for the printer';
			case 'reading':
				return `Reading from printer… ${uploadPct(u)}% · ${size(u.forwarded)} of ${size(u.size)}${left}`;
			case 'sending':
				return `Sending to printer… ${uploadPct(u)}% · ${size(u.forwarded)} of ${size(u.size)}${left}`;
			case 'done':
				return u.from ? 'Renamed' : 'Uploaded';
			case 'conflict':
				return u.error ?? 'Already on the printer';
			case 'error':
				return u.error ?? (u.from ? 'Rename failed' : 'Upload failed');
			default:
				return `Uploading… ${uploadPct(u)}% · ${size(u.sent)} of ${size(u.size)}`;
		}
	}

	const showsBar = (u: Upload) =>
		u.status === 'uploading' ||
		u.status === 'reading' ||
		u.status === 'sending' ||
		u.status === 'done';

	function fileMeta(file: PrinterFile): string {
		const f = controller.metaOf(file);
		const parts = [
			f.printSeconds != null ? formatEta(f.printSeconds) : '',
			f.material ?? '',
			formatFilament(f.filamentGrams, f.filamentMeters),
		];
		return parts.filter(Boolean).join(' · ');
	}

	// Rename edits the stem only; the extension is fixed (the server enforces the same rule).
	let renaming = $state<string | null>(null);
	let draft = $state('');

	function splitName(name: string): [string, string] {
		const lower = name.toLowerCase();
		const ext = ['.bgcode', '.gcode', '.bgc', '.gco', '.g'].find((e) => lower.endsWith(e)) ?? '';
		return [name.slice(0, name.length - ext.length), name.slice(name.length - ext.length)];
	}

	function startRename(f: PrinterFile) {
		renaming = f.name;
		draft = splitName(f.displayName)[0];
	}

	async function submitRename(f: PrinterFile) {
		const stem = draft.trim();
		if (!stem || stem === splitName(f.displayName)[0]) {
			renaming = null;
			return;
		}
		if (await controller.rename(f, stem + splitName(f.displayName)[1])) renaming = null;
	}

	function onRenameKey(e: KeyboardEvent, f: PrinterFile) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void submitRename(f);
		} else if (e.key === 'Escape') {
			renaming = null;
		}
	}

	function focusSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
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
				<span class="file-name">{u.from ? `${u.from} → ${u.name}` : u.name}</span>
				<span class="upload-status">{uploadLabel(u)}</span>
			</div>

			{#if showsBar(u)}
				<div class="progress upload-progress">
					<div class="progress-bar" style="width: {uploadPct(u)}%"></div>
					<span class="progress-label">{uploadPct(u)}%</span>
				</div>
			{/if}

			<div class="file-actions">
				{#if u.status === 'conflict' && u.file}
					<button class="btn-inline" onclick={() => controller.replace(u)}>Replace</button>
				{:else if u.status === 'error' && u.file}
					<button
						class="btn-icon"
						title="Retry"
						aria-label="Retry {u.name}"
						onclick={() => controller.retry(u)}
					>
						<Icon name="rotate-left" />
					</button>
				{:else if u.status === 'queued' || u.status === 'uploading'}
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
		<div class="files-toolbar">
			<input
				type="search"
				class="files-search"
				placeholder="Search files"
				aria-label="Search files"
				bind:value={controller.query}
			/>
			<div class="files-sort" role="group" aria-label="Sort files">
				{#each SORT_KEYS as s (s.key)}
					{@const active = controller.sortKey === s.key}
					<button
						class="files-sort-btn"
						class:is-active={active}
						aria-pressed={active}
						title={active
							? `Sorted ${controller.sortDir === 'asc' ? 'ascending' : 'descending'}`
							: `Sort by ${s.label.toLowerCase()}`}
						onclick={() => controller.sortBy(s.key)}
					>
						{s.label}
						{#if active}
							<Icon name="arrow-up" class={controller.sortDir === 'desc' ? 'is-desc' : ''} />
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="files-bulk">
			<label class="files-select-all">
				<input
					type="checkbox"
					checked={controller.allSelected}
					indeterminate={controller.selected.size > 0 && !controller.allSelected}
					disabled={controller.deletable.length === 0 || controller.deleting}
					onchange={() => controller.toggleAll()}
				/>
				{controller.query.trim() ? 'Select matches' : 'Select all'}
			</label>
			{#if controller.selected.size > 0}
				<button
					class="btn-inline btn-stop-print"
					class:is-armed={deleteArmed}
					disabled={controller.deleting}
					onclick={onDeleteSelected}
					onblur={disarmDelete}
				>
					<Icon name="trash" />
					{controller.deleting
						? 'Deleting…'
						: deleteArmed
							? `Confirm delete ${controller.selected.size}`
							: `Delete ${controller.selected.size}`}
				</button>
			{/if}
		</div>

		{#if controller.shown.length === 0}
			<p class="files-empty">No files match “{controller.query.trim()}”.</p>
		{/if}

		<ul class="file-list">
			{#each visible as f (f.name)}
				<li
					class="file-row"
					class:is-busy={controller.busy === f.name}
					class:is-selected={controller.selected.has(f.name)}
				>
					<input
						type="checkbox"
						class="file-check"
						aria-label="Select {f.displayName}"
						checked={controller.selected.has(f.name)}
						disabled={f.readOnly === true || controller.deleting}
						onchange={() => controller.toggle(f.name)}
					/>
					{#if renaming === f.name}
						<span class="file-rename">
							<input
								class="files-search file-rename-input"
								aria-label="New name for {f.displayName}"
								bind:value={draft}
								use:focusSelect
								onkeydown={(e) => onRenameKey(e, f)}
								disabled={controller.busy === f.name}
							/>
							<span class="file-size">{splitName(f.displayName)[1]}</span>
							<button
								class="btn-icon"
								title="Save name"
								aria-label="Save new name"
								disabled={controller.busy !== null}
								onclick={() => submitRename(f)}
							>
								<Icon name="check" />
							</button>
							<button
								class="btn-icon"
								title="Cancel"
								aria-label="Cancel rename"
								onclick={() => (renaming = null)}
							>
								<Icon name="xmark" />
							</button>
						</span>
					{:else}
						<span class="file-main">
							<span class="file-name">{f.displayName}</span>
							{#if fileMeta(f)}
								<span class="file-meta">{fileMeta(f)}</span>
							{/if}
						</span>
					{/if}
					<span
						class="file-date"
						title={f.modifiedAt != null ? timeFmt.format(f.modifiedAt) : undefined}
					>
						{f.modifiedAt != null ? dateFmt.format(f.modifiedAt) : '—'}
					</span>
					<span class="file-size">{size(f.size)}</span>
					<span class="file-actions">
						{#if f.downloadUrl}
							<a
								class="btn-icon"
								href={apiUrl(f.downloadUrl)}
								download={f.displayName}
								title="Download"
								aria-label="Download {f.displayName}"
							>
								<Icon name="download" />
							</a>
						{/if}
						<button
							class="btn-icon"
							title="Rename"
							aria-label="Rename {f.displayName}"
							disabled={controller.busy !== null || f.readOnly === true}
							onclick={() => startRename(f)}
						>
							<Icon name="pen" />
						</button>
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
		{:else if expanded && controller.shown.length > FOLD_AT}
			<button class="files-more-btn" onclick={() => (expanded = false)}>Show less</button>
		{/if}
	{/if}
</div>
