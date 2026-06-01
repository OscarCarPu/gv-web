<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { formatTime, toLocalDateString, toISOString } from '$lib/shared/utils/datetime';
	import PlanBlockEditor from './PlanBlockEditor.svelte';
	import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
	import Modal from '$lib/shared/components/Modal.svelte';

	interface Props {
		initial: PlanTodayResponse | null;
		ontimerstart: (taskId: number, taskName: string, projectName?: string | null) => Promise<void>;
		onafterchange: () => Promise<void> | void;
		isTimerRunning: boolean;
		activeStartedAt: string | null;
	}

	let { initial, ontimerstart, onafterchange, isTimerRunning, activeStartedAt }: Props = $props();

	let data = $derived(initial);
	let editorOpen = $state(false);
	let editingBlock = $state<PlanBlockResponse | null>(null);

	let nowMs = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (nowMs = Date.now()), 60_000);
		return () => clearInterval(id);
	});

	async function refresh() {
		await onafterchange();
	}

	function formatHour(iso: string): string {
		const d = new Date(iso);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function blockSeconds(b: PlanBlockResponse): number {
		return Math.max(0, (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000);
	}

	function isStarted(b: PlanBlockResponse): boolean {
		return b.task_started_at !== null && b.task_started_at !== undefined;
	}

	function toggleLabel(b: PlanBlockResponse): string {
		if (!isStarted(b)) return 'Start';
		return b.task_type === 'recurring' ? 'Renew' : 'Done';
	}

	function buildRecurringDueAt(recurrence: number): string {
		const d = new Date();
		d.setDate(d.getDate() + recurrence);
		return toISOString(toLocalDateString(d) + 'T12:00')!;
	}

	async function handleToggle(b: PlanBlockResponse) {
		if (b.task_id === null) return;
		const now = new Date().toISOString();
		try {
			if (!isStarted(b)) {
				await tasksApi.updateTask(b.task_id, { started_at: now });
			} else if (b.task_type === 'recurring' && b.task_recurrence) {
				await tasksApi.updateTask(b.task_id, {
					due_at: buildRecurringDueAt(b.task_recurrence),
				});
			} else {
				await tasksApi.updateTask(b.task_id, { finished_at: now });
			}
			await refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error';
			addToast(msg, 'error');
		}
	}

	async function handleTimer(b: PlanBlockResponse) {
		if (b.task_id === null || b.task_name === null) return;
		await ontimerstart(b.task_id, b.task_name);
		await refresh();
	}

	async function handleDelete(b: PlanBlockResponse) {
		try {
			await planApi.deleteBlock(b.id);
			await refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error deleting';
			addToast(msg, 'error');
		}
	}

	async function handleCleanFuture() {
		try {
			await planApi.deleteFutureBlocks();
			await refresh();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error cleaning';
			addToast(msg, 'error');
		}
	}

	function openCreate() {
		editingBlock = null;
		editorOpen = true;
	}

	function openEdit(b: PlanBlockResponse) {
		editingBlock = b;
		editorOpen = true;
	}

	const freeTotal = $derived(data?.totals.free_seconds ?? 0);
	const dailyTarget = $derived(data?.budget.daily_target_seconds ?? 0);

	// Done so far today (real time entries, not the plan).
	const doneTodaySeconds = $derived(data?.budget.today ?? 0);
	// Future task work according to the plan: linked blocks whose end is in the future.
	// Full duration if the block hasn't started yet, only the remaining part if it's in progress.
	const futureTaskSeconds = $derived.by(() => {
		if (!data) return 0;
		let s = 0;
		for (const b of data.blocks) {
			if (b.task_id === null) continue;
			const start = new Date(b.started_at).getTime();
			const end = new Date(b.ended_at).getTime();
			if (end <= nowMs) continue;
			s += (end - Math.max(start, nowMs)) / 1000;
		}
		return s;
	});
	// Elapsed time of the currently running time entry (not yet finished).
	const activeRunningSeconds = $derived.by(() => {
		if (!activeStartedAt) return 0;
		return Math.max(0, (nowMs - new Date(activeStartedAt).getTime()) / 1000);
	});
	const estimatedTotal = $derived(doneTodaySeconds + activeRunningSeconds + futureTaskSeconds);
	const estimatedPct = $derived(
		dailyTarget > 0 ? Math.min((estimatedTotal / dailyTarget) * 100, 100) : 0
	);
	const estimatedReached = $derived(dailyTarget > 0 && estimatedTotal >= dailyTarget);

	function formatNow(ms: number): string {
		const d = new Date(ms);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	// Index of the block currently in progress (started_at <= now < ended_at), or -1.
	const currentIndex = $derived.by(() => {
		if (!data) return -1;
		for (let i = 0; i < data.blocks.length; i++) {
			const start = new Date(data.blocks[i].started_at).getTime();
			const end = new Date(data.blocks[i].ended_at).getTime();
			if (start <= nowMs && nowMs < end) return i;
		}
		return -1;
	});

	// Where to render the "now" line when there is no current block:
	// before the first block whose started_at is strictly after now.
	// -1 means now has passed every block — line goes at the end.
	const gapInsertIndex = $derived.by(() => {
		if (!data || currentIndex !== -1) return -2; // -2 = don't render line
		for (let i = 0; i < data.blocks.length; i++) {
			if (new Date(data.blocks[i].started_at).getTime() > nowMs) return i;
		}
		return -1;
	});

	let notifyOnChange = $state(false);
	let alarmOpen = $state(false);
	let alarmBlock = $state<PlanBlockResponse | null>(null);
	let prevCurrentIndex = -1;
	let audioCtx: AudioContext | null = null;
	let alarmInterval: ReturnType<typeof setInterval> | null = null;

	function startAlarmSound() {
		if (typeof window === 'undefined') return;
		if (!audioCtx) audioCtx = new AudioContext();
		let high = true;

		function chirp() {
			if (!audioCtx) return;
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = 'square';
			osc.frequency.value = high ? 960 : 800;
			high = !high;
			osc.connect(gain);
			gain.connect(audioCtx.destination);
			const t = audioCtx.currentTime;
			gain.gain.setValueAtTime(0.55, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
			osc.start(t);
			osc.stop(t + 0.17);
		}

		chirp();
		alarmInterval = setInterval(chirp, 200);
	}

	function stopAlarmSound() {
		if (alarmInterval) {
			clearInterval(alarmInterval);
			alarmInterval = null;
		}
	}

	function stopAlarm() {
		alarmOpen = false;
		stopAlarmSound();
	}

	$effect(() => {
		if (notifyOnChange && currentIndex !== -1 && currentIndex !== prevCurrentIndex) {
			alarmBlock = data?.blocks[currentIndex] ?? null;
			alarmOpen = true;
			startAlarmSound();
		}
		prevCurrentIndex = currentIndex;
	});
</script>

<div id="plan-section" class="tasks-section">
	<div class="section-header">
		<div class="section-title">
			<h2>Today's Plan</h2>
			<button
				class="btn-icon back-to-top"
				onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
				title="Back to top"
			>
				<Icon name="arrow-up" />
			</button>
		</div>
		<div class="section-actions">
			<button
				class="btn-icon plan-notify-btn"
				class:active={notifyOnChange}
				onclick={() => (notifyOnChange = !notifyOnChange)}
				title={notifyOnChange ? 'Notifications on' : 'Notifications off'}
				aria-label={notifyOnChange ? 'Disable block notifications' : 'Enable block notifications'}
			>
				<Icon name="bell" />
			</button>
			<button
				class="btn-icon"
				onclick={handleCleanFuture}
				title="Clear future blocks"
				aria-label="Clear future blocks"
			>
				<Icon name="trash" />
			</button>
			<button class="btn-primary btn-sm" onclick={openCreate}>
				<Icon name="plus" /> Block
			</button>
		</div>
	</div>

	{#if data === null}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>Plan could not be loaded</span>
		</div>
	{:else}
		<div class="plan-summary">
			<div class="plan-summary-row" class:goal-reached={estimatedReached}>
				<span class="plan-summary-label">Est.</span>
				<div class="progress-track bg-bg">
					<div class="progress-fill" style="width: {estimatedPct}%"></div>
				</div>
				<span class="plan-summary-value">
					{formatTime(estimatedTotal)} / {formatTime(dailyTarget)}
				</span>
			</div>
			<div class="plan-summary-row">
				<span class="plan-summary-label">Free</span>
				<span class="plan-summary-value">{formatTime(freeTotal)}</span>
			</div>
		</div>

		{#if data.blocks.length === 0}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>No blocks for today</span>
			</div>
		{:else}
			<div class="plan-list">
				{#each data.blocks as b, i (b.id)}
					{#if i === gapInsertIndex}
						<div class="plan-now-divider">
							<span class="plan-now-line"></span>
							<span class="plan-now-label">{formatNow(nowMs)}</span>
							<span class="plan-now-line"></span>
						</div>
					{/if}
					{@const finished = b.task_finished_at !== null && b.task_finished_at !== undefined}
					<div
						class="plan-block"
						class:plan-block-free={b.task_id === null}
						class:plan-block-finished={finished}
						class:plan-block-current={i === currentIndex}
					>
						<div class="plan-block-time">
							{formatHour(b.started_at)}<br />{formatHour(b.ended_at)}
						</div>
						<div class="plan-block-body">
							<div class="plan-block-name">{b.label}</div>
							<div class="plan-block-meta">
								<span>{formatTime(blockSeconds(b))}</span>
								{#if b.note}<span class="plan-block-note">· {b.note}</span>{/if}
							</div>
						</div>
						<div class="plan-block-actions">
							{#if b.task_id !== null}
								{#if finished}
									<button class="btn-primary btn-start btn-sm" disabled>Done</button>
								{:else}
									<button
										class="btn-primary btn-sm"
										class:btn-start={!isStarted(b)}
										onclick={() => handleToggle(b)}
									>
										{toggleLabel(b)}
									</button>
									<button class="btn-primary btn-sm" onclick={() => handleTimer(b)}>
										<Icon name={isTimerRunning ? 'arrow-right' : 'play'} />
										{isTimerRunning ? 'Assign' : 'Start'}
									</button>
								{/if}
							{/if}
							<button class="btn-icon" onclick={() => openEdit(b)} aria-label="Edit block">
								<Icon name="pen" />
							</button>
							<button class="btn-icon" onclick={() => handleDelete(b)} aria-label="Delete block">
								<Icon name="trash" />
							</button>
						</div>
					</div>
				{/each}
				{#if gapInsertIndex === -1 && data.blocks.length > 0}
					<div class="plan-now-divider">
						<span class="plan-now-line"></span>
						<span class="plan-now-label">{formatNow(nowMs)}</span>
						<span class="plan-now-line"></span>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<PlanBlockEditor
	open={editorOpen}
	block={editingBlock}
	onclose={() => (editorOpen = false)}
	onsaved={refresh}
/>

<Modal open={alarmOpen} onclose={stopAlarm} narrow>
	<div class="plan-alarm">
		<div class="modal-title">Block started</div>
		{#if alarmBlock}
			<p class="plan-alarm-label">{alarmBlock.label}</p>
			<p class="plan-alarm-time">
				{formatHour(alarmBlock.started_at)} – {formatHour(alarmBlock.ended_at)}
			</p>
		{/if}
		<button class="btn btn-primary plan-alarm-dismiss" onclick={stopAlarm}>Dismiss</button>
	</div>
</Modal>
