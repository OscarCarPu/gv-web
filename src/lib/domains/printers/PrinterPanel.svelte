<script lang="ts">
	import { onDestroy } from 'svelte';
	import { PrinterController } from './printerStatus.svelte';

	interface Props {
		id: string;
		name: string;
		model: string;
		/** Camera refresh interval in ms (200 = ~5 fps). */
		camIntervalMs?: number;
	}

	let { id, name, model, camIntervalMs = 200 }: Props = $props();

	const controller = new PrinterController(id);

	let camSrc = $state<string | null>(null);
	let camReady = $state(false);
	let camError = $state(false);

	let camTimer: ReturnType<typeof setInterval> | null = null;

	function refreshCam() {
		const url = `/printers/${id}/camera?t=${Date.now()}`;
		const img = new Image();
		img.onload = () => {
			camSrc = url;
			camReady = true;
			camError = false;
		};
		img.onerror = () => {
			camError = true;
		};
		img.src = url;
	}

	$effect(() => {
		controller.start(2000);
		refreshCam();
		camTimer = setInterval(refreshCam, camIntervalMs);
		return () => {
			controller.stop();
			if (camTimer) clearInterval(camTimer);
		};
	});

	onDestroy(() => {
		controller.stop();
		if (camTimer) clearInterval(camTimer);
	});

	const t = $derived(controller.telemetry);

	// ---- formatting helpers ----
	function temp(cur?: number, target?: number): string {
		if (cur == null) return '—';
		const base = `${Math.round(cur)}°`;
		if (target != null && target > 0) return `${base} → ${Math.round(target)}°`;
		return base;
	}
	// The API reports fan speed only in RPM, so the % is relative to these
	// per-fan maxima (tune per printer if needed).
	const HOTEND_FAN_MAX = 8700;
	const PRINT_FAN_MAX = 6700;
	function fan(v?: number, max?: number): string {
		if (v == null) return '—';
		const p = max ? Math.round((v / max) * 100) : null;
		return p != null ? `${Math.round(v)} rpm · ${p}%` : `${Math.round(v)} rpm`;
	}
	function mm(v?: number): string {
		return v == null ? '—' : `${v.toFixed(2)} mm`;
	}
	function pct(v?: number): string {
		return v == null ? '—' : `${Math.round(v)}%`;
	}
	function duration(s?: number): string {
		if (s == null) return '—';
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m`;
		return `${Math.floor(s)}s`;
	}

	const stateClass = $derived.by(() => {
		const s = (t?.state ?? '').toUpperCase();
		if (s === 'PRINTING') return 'is-printing';
		if (s === 'PAUSED') return 'is-paused';
		if (s === 'FINISHED' || s === 'STOPPED') return 'is-done';
		if (s === 'ERROR' || s === 'ATTENTION') return 'is-error';
		return 'is-idle';
	});
</script>

<section class="printer">
	<div class="printer-cam">
		{#if camSrc}
			<img src={camSrc} alt="{name} live camera" class:ready={camReady} />
		{/if}
		{#if !camReady}
			<div class="cam-placeholder">
				{camError ? 'Camera unavailable' : 'Connecting to camera…'}
			</div>
		{/if}
		<span class="cam-live">● LIVE</span>
	</div>

	<div class="printer-head">
		<div>
			<h2>{name}</h2>
			<p class="printer-model">{model}</p>
		</div>
		<span class="state-badge {stateClass}">{t?.state ?? (t ? 'UNKNOWN' : '…')}</span>
	</div>

	{#if t?.job?.progress != null}
		<div class="progress-block">
			<div class="progress">
				<div
					class="progress-bar"
					style="width: {Math.min(100, Math.max(0, t.job.progress))}%"
				></div>
				<span class="progress-label">{pct(t.job.progress)}</span>
			</div>
			<div class="progress-times">
				<span class="ptime">
					<span class="ptime-label">Time left</span>
					<span class="ptime-value">{duration(t.job.timeRemaining)}</span>
				</span>
				<span class="ptime">
					<span class="ptime-label">Printing</span>
					<span class="ptime-value">{duration(t.job.timePrinting)}</span>
				</span>
			</div>
		</div>
	{/if}

	<div class="stats">
		<div class="stat">
			<span class="stat-label">Nozzle</span>
			<span class="stat-value">{temp(t?.temps.nozzle, t?.temps.nozzleTarget)}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Bed</span>
			<span class="stat-value">{temp(t?.temps.bed, t?.temps.bedTarget)}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Print fan</span>
			<span class="stat-value">{fan(t?.fans.print, PRINT_FAN_MAX)}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Hotend fan</span>
			<span class="stat-value">{fan(t?.fans.hotend, HOTEND_FAN_MAX)}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Z axis</span>
			<span class="stat-value">{mm(t?.axisZ)}</span>
		</div>
		<div class="stat">
			<span class="stat-label">Material</span>
			<span class="stat-value">{t?.job?.material ?? '—'}</span>
		</div>
		<div class="stat stat-wide">
			<span class="stat-label">File</span>
			<span class="stat-value stat-file">{t?.job?.fileName ?? '—'}</span>
		</div>
	</div>

	{#if t && !t.configured}
		<p class="notice">
			PrusaLink telemetry not configured. Set <code>PRUSALINK_HOST</code>,
			<code>PRUSALINK_USER</code> and <code>PRUSALINK_PASSWORD</code> to show temperatures,
			progress and state.
		</p>
	{:else if t && t.configured && !t.online}
		<p class="notice notice-error">
			PrusaLink unreachable{t.error ? `: ${t.error}` : ''}.
		</p>
	{/if}
</section>
