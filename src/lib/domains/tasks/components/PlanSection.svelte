<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatTime } from '$lib/shared/utils/datetime';
	import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
	import { PlanAlarm } from '$lib/domains/tasks/planAlarm.svelte';
	import PlanBlockEditor from './PlanBlockEditor.svelte';
	import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
	import type { TimerTask } from '$lib/domains/tasks/taskTimer.svelte';
	import Modal from '$lib/shared/components/Modal.svelte';

	interface Props {
		initial: PlanTodayResponse | null;
		onstart: (task: TimerTask) => void;
		onassign: (task: TimerTask) => void;
		onstopandstart: (task: TimerTask) => void;
		onafterchange: () => Promise<void> | void;
		isTimerRunning: boolean;
		activeStartedAt: string | null;
	}

	let {
		initial,
		onstart,
		onassign,
		onstopandstart,
		onafterchange,
		isTimerRunning,
		activeStartedAt,
	}: Props = $props();

	const board = new PlanBoard(
		() => initial,
		() => activeStartedAt,
		refresh
	);
	const alarm = new PlanAlarm();

	let editorOpen = $state(false);
	let editingBlock = $state<PlanBlockResponse | null>(null);

	$effect(() => {
		const id = setInterval(() => board.setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	});

	$effect(() => {
		alarm.watch(board.currentIndex, board.data?.blocks[board.currentIndex] ?? null);
	});

	$effect(() => () => alarm.destroy());

	async function refresh() {
		await onafterchange();
	}

	async function handleTimer(b: PlanBlockResponse) {
		if (b.task_id === null || b.task_name === null) return;
		await onstart({ id: b.task_id, name: b.task_name });
		await refresh();
	}

	async function handleAssign(b: PlanBlockResponse) {
		if (b.task_id === null || b.task_name === null) return;
		await onassign({ id: b.task_id, name: b.task_name });
		await refresh();
	}

	async function handleTimerStopAndStart(b: PlanBlockResponse) {
		if (b.task_id === null || b.task_name === null) return;
		await onstopandstart({ id: b.task_id, name: b.task_name });
		await refresh();
	}

	function openCreate() {
		editingBlock = null;
		editorOpen = true;
	}

	function openEdit(b: PlanBlockResponse) {
		editingBlock = b;
		editorOpen = true;
	}

	function dismissAlarm(scroll = false) {
		alarm.dismiss();
		if (scroll) {
			document.getElementById('plan-section')?.scrollIntoView({ behavior: 'smooth' });
		}
	}
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
				class:active={alarm.enabled}
				onclick={() => (alarm.enabled = !alarm.enabled)}
				title={alarm.enabled ? 'Notifications on' : 'Notifications off'}
				aria-label={alarm.enabled ? 'Disable block notifications' : 'Enable block notifications'}
			>
				<Icon name={alarm.enabled ? 'bell-sound' : 'bell'} />
			</button>
			<button
				class="btn-icon"
				onclick={() => board.cleanFuture()}
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

	{#if board.data === null}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>Plan could not be loaded</span>
		</div>
	{:else}
		<div class="plan-summary">
			<div class="plan-summary-row" class:goal-reached={board.estimatedReached}>
				<span class="plan-summary-label">Est.</span>
				<div class="progress-track bg-bg">
					<div class="progress-fill" style="width: {board.estimatedPct}%"></div>
				</div>
				<span class="plan-summary-value">
					{formatTime(board.estimatedTotal)} / {formatTime(board.dailyTarget)}
				</span>
			</div>
			<div class="plan-summary-row">
				<span class="plan-summary-label">Free</span>
				<span class="plan-summary-value">{formatTime(board.freeTotal)}</span>
			</div>
		</div>

		{#if board.data.blocks.length === 0}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>No blocks for today</span>
			</div>
		{:else}
			<div class="plan-list">
				{#each board.data.blocks as b, i (b.id)}
					{#if i === board.gapInsertIndex}
						<div class="plan-now-divider">
							<span class="plan-now-line"></span>
							<span class="plan-now-label">{PlanBoard.formatNow(board.nowMs)}</span>
							<span class="plan-now-line"></span>
						</div>
					{/if}
					{@const finished = b.task_finished_at !== null && b.task_finished_at !== undefined}
					<div
						class="plan-block"
						class:plan-block-free={b.task_id === null}
						class:plan-block-finished={finished}
						class:plan-block-current={i === board.currentIndex}
					>
						<div class="plan-block-time">
							{PlanBoard.formatHour(b.started_at)}<br />{PlanBoard.formatHour(b.ended_at)}
						</div>
						<div class="plan-block-body">
							<div class="plan-block-name">{b.label}</div>
							<div class="plan-block-meta">
								<span>{formatTime(PlanBoard.blockSeconds(b))}</span>
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
										class:btn-start={!PlanBoard.isStarted(b)}
										onclick={() => board.toggleBlock(b)}
									>
										{PlanBoard.toggleLabel(b)}
									</button>
									{#if isTimerRunning}
										<div class="btn-split">
											<button class="btn-primary btn-sm" onclick={() => handleAssign(b)}>
												<Icon name="arrow-right" />Assign
											</button>
											<button class="btn-success btn-sm" onclick={() => handleTimerStopAndStart(b)}>
												<Icon name="play" />{b.task_type === 'recurring'
													? 'Renew Start'
													: 'Stop Start'}
											</button>
										</div>
									{:else}
										<button class="btn-primary btn-sm" onclick={() => handleTimer(b)}>
											<Icon name="play" />Start
										</button>
									{/if}
								{/if}
							{/if}
							<button class="btn-icon" onclick={() => openEdit(b)} aria-label="Edit block">
								<Icon name="pen" />
							</button>
							<button
								class="btn-icon"
								onclick={() => board.deleteBlock(b)}
								aria-label="Delete block"
							>
								<Icon name="trash" />
							</button>
						</div>
					</div>
				{/each}
				{#if board.gapInsertIndex === -1 && board.data.blocks.length > 0}
					<div class="plan-now-divider">
						<span class="plan-now-line"></span>
						<span class="plan-now-label">{PlanBoard.formatNow(board.nowMs)}</span>
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

<Modal open={alarm.alarmOpen} onclose={() => dismissAlarm()} narrow>
	<div class="plan-alarm">
		<div class="modal-title">Block started</div>
		{#if alarm.alarmBlock}
			<p class="plan-alarm-label">{alarm.alarmBlock.label}</p>
			<p class="plan-alarm-time">
				{PlanBoard.formatHour(alarm.alarmBlock.started_at)} – {PlanBoard.formatHour(
					alarm.alarmBlock.ended_at
				)}
			</p>
		{/if}
		<button class="btn btn-primary plan-alarm-dismiss" onclick={() => dismissAlarm(true)}
			>Dismiss</button
		>
	</div>
</Modal>
