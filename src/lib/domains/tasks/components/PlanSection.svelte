<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatTime, isoToHHmm, toLocalDateString } from '$lib/shared/utils/datetime';
	import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
	import { PlanAlarm } from '$lib/domains/tasks/planAlarm.svelte';
	import PlanBlockEditor from './PlanBlockEditor.svelte';
	import CommitmentsSheet from './CommitmentsSheet.svelte';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';
	import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';
	import type { DayFreeBusy } from '$lib/domains/capacity/types/Capacity.types';
	import type { TimerTask } from '$lib/domains/tasks/taskTimer.svelte';
	import Modal from '$lib/shared/components/Modal.svelte';

	interface Props {
		initial: PlanTodayResponse | null;
		/** Today's real time entries — these are what rewrite the past half of the plan. */
		entries: TimeEntryWithTask[];
		/** Next 7 days' capacity/busy/free breakdown — shows *why* a task is urgent at a glance. */
		freeBusy: DayFreeBusy[];
		onstart: (task: TimerTask) => void;
		onassign: (task: TimerTask) => void;
		onstopandstart: (task: TimerTask) => void;
		onafterchange: () => Promise<void> | void;
		onopenentry: (entry: TimeEntryWithTask) => void;
		isTimerRunning: boolean;
	}

	let {
		initial,
		entries,
		freeBusy,
		onstart,
		onassign,
		onstopandstart,
		onafterchange,
		onopenentry,
		isTimerRunning,
	}: Props = $props();

	const capacityDayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' });

	function capacityDayLabel(dateStr: string): string {
		return capacityDayFormatter.format(new Date(`${dateStr}T00:00:00`));
	}

	function capacityFreePct(day: DayFreeBusy): number {
		const capacity = parseFloat(day.capacity_hours);
		const free = parseFloat(day.free_hours);
		if (!Number.isFinite(capacity) || capacity <= 0) return 0;
		return Math.max(0, Math.min(100, (free / capacity) * 100));
	}

	const board = new PlanBoard(
		() => initial,
		() => entries,
		refresh
	);
	const alarm = new PlanAlarm();

	let editorOpen = $state(false);
	let editingBlock = $state<PlanBlockResponse | null>(null);
	let commitmentsOpen = $state(false);

	// Clicking a day in the capacity strip switches the section to that day's plan instead of
	// today's — a plain block list (no "now" line, no actual-vs-planned merge, those only make
	// sense for today), and "+ Block" creates on that day. Selecting today's own cell goes back.
	let selectedDate = $state(toLocalDateString());
	const isToday = $derived(selectedDate === toLocalDateString());
	let otherDayBlocks = $state<PlanBlockResponse[] | null>(null);

	async function loadOtherDay(dateStr: string) {
		const next = new Date(`${dateStr}T00:00:00`);
		next.setDate(next.getDate() + 1);
		try {
			const range = await planApi.getRange(dateStr, toLocalDateString(next));
			otherDayBlocks = [...range.blocks].sort(
				(a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
			);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Error loading plan', 'error');
			otherDayBlocks = [];
		}
	}

	$effect(() => {
		if (!isToday) loadOtherDay(selectedDate);
	});

	async function deleteOtherDayBlock(b: PlanBlockResponse) {
		try {
			await planApi.deleteBlock(b.id);
			await refresh();
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Error deleting', 'error');
		}
	}

	$effect(() => {
		const id = setInterval(() => board.setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	});

	// "Back to top" only means something once there's somewhere to go back from.
	let scrolledDown = $state(false);
	$effect(() => {
		function onScroll() {
			scrolledDown = window.scrollY > 200;
		}
		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});

	// The minute interval above is enough to advance the "now" line, but not to keep up with a
	// timer the user just started or stopped: work recorded since the last tick would sit ahead
	// of `nowMs` and read as future-dated, so the row would not render. Re-tick whenever the
	// entry set changes so the clock is always current at the moment it matters.
	$effect(() => {
		// Touch every entry so a create, a finish, or a delete all re-tick the clock.
		for (const e of entries) void e.finished_at;
		board.setNow(Date.now());
	});

	$effect(() => {
		alarm.watch(board.currentBlock);
	});

	$effect(() => () => alarm.destroy());

	async function refresh() {
		await onafterchange();
		if (!isToday) await loadOtherDay(selectedDate);
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

	function openEntry(entryId: number) {
		const entry = entries.find((e) => e.id === entryId);
		if (entry) onopenentry(entry);
	}

	/** Stable keys: entries and blocks can share numeric ids, so namespace by kind. */
	function itemKey(item: (typeof board.items)[number], i: number): string {
		switch (item.kind) {
			case 'actual':
				return `a${item.entryId}`;
			case 'rest':
			case 'skipped':
			case 'planned':
				return `b${item.block.id}-${item.kind}`;
			default:
				return `${item.kind}-${i}`;
		}
	}
</script>

<div id="plan-section" class="tasks-section">
	<div class="section-header">
		<div class="section-title">
			<h2>{isToday ? "Today's Plan" : `Plan · ${capacityDayLabel(selectedDate)}`}</h2>
			{#if !isToday}
				<button
					class="btn-icon"
					onclick={() => (selectedDate = toLocalDateString())}
					title="Back to today"
					aria-label="Back to today"
				>
					<Icon name="rotate-left" />
				</button>
			{/if}
			{#if scrolledDown}
				<button
					class="btn-icon back-to-top"
					onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
					title="Back to top"
				>
					<Icon name="arrow-up" />
				</button>
			{/if}
		</div>
		<div class="section-actions">
			{#if isToday}
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
			{/if}
			<button class="btn-primary btn-sm" onclick={openCreate}>
				<Icon name="plus" /> Block
			</button>
		</div>
	</div>

	{#if freeBusy.length > 0}
		<div class="capacity-strip-header">
			<span class="capacity-strip-title">Free time (next 7 days)</span>
			<button
				type="button"
				class="btn-icon"
				title="Recurring commitments"
				onclick={() => (commitmentsOpen = true)}
			>
				<Icon name="pen" />
			</button>
		</div>
		<div class="capacity-strip">
			{#each freeBusy as day (day.date)}
				{@const pct = capacityFreePct(day)}
				<button
					type="button"
					class="capacity-strip-day"
					class:tight={pct > 0 && pct < 25}
					class:full={pct <= 0}
					class:selected={day.date === selectedDate}
					onclick={() => (selectedDate = day.date)}
				>
					<span class="capacity-strip-label">{capacityDayLabel(day.date)}</span>
					<div class="capacity-strip-bar">
						<div class="capacity-strip-fill" style="height: {pct}%"></div>
					</div>
					<span class="capacity-strip-hours">{parseFloat(day.free_hours).toFixed(0)}h</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if !isToday}
		{#if otherDayBlocks === null}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>Loading…</span>
			</div>
		{:else if otherDayBlocks.length === 0}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>No blocks for this day</span>
			</div>
		{:else}
			<div class="plan-list">
				{#each otherDayBlocks as b (b.id)}
					<div class="plan-block" class:plan-block-free={b.task_id === null}>
						<div class="plan-block-time">
							{isoToHHmm(b.started_at)}<br />{isoToHHmm(b.ended_at)}
						</div>
						<div class="plan-block-body">
							<div class="plan-block-name">{b.label}</div>
							{#if b.note}
								<div class="plan-block-meta"><span class="plan-block-note">{b.note}</span></div>
							{/if}
						</div>
						<div class="plan-block-actions">
							<button class="btn-icon" onclick={() => openEdit(b)} aria-label="Edit block">
								<Icon name="pen" />
							</button>
							<button
								class="btn-icon"
								onclick={() => deleteOtherDayBlock(b)}
								aria-label="Delete block"
							>
								<Icon name="trash" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else if board.data === null}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>Plan could not be loaded</span>
		</div>
	{:else}
		<div class="plan-summary">
			<div class="plan-summary-row" class:goal-reached={board.estimatedReached}>
				<span class="plan-summary-label">Est.</span>
				<div class="progress-track bg-bg plan-progress">
					<!-- Two-tone: solid = already logged, translucent = projected from the plan. -->
					<div class="progress-fill plan-progress-est" style="width: {board.estimatedPct}%"></div>
					<div class="progress-fill plan-progress-done" style="width: {board.donePct}%"></div>
				</div>
				<span class="plan-summary-value">
					{formatTime(board.doneTodaySeconds)} → {formatTime(board.estimatedTotal)} / {formatTime(
						board.dailyTarget
					)}
				</span>
			</div>
			<div class="plan-summary-row plan-summary-chips">
				<span class="plan-summary-label">Free</span>
				<span class="plan-summary-value">{formatTime(board.freeTotal)}</span>
				{#if board.skippedSeconds > 0}
					<span class="plan-chip plan-chip-skipped">
						{formatTime(board.skippedSeconds)} skipped
					</span>
				{/if}
			</div>
		</div>

		{#if board.data.blocks.length === 0 && entries.length === 0}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>No blocks for today</span>
			</div>
		{:else}
			<div class="plan-list">
				{#each board.items as item, i (itemKey(item, i))}
					{#if item.kind === 'now'}
						<div class="plan-now-divider">
							<span class="plan-now-line"></span>
							<span class="plan-now-label">{isoToHHmm(item.ms)}</span>
							<span class="plan-now-line"></span>
						</div>
					{:else if item.kind === 'gap'}
						<div class="plan-gap">
							<span class="plan-gap-line"></span>
							<span class="plan-gap-label">
								{isoToHHmm(item.from)} – {isoToHHmm(item.to)} · {formatTime(item.seconds)} unaccounted
							</span>
							<span class="plan-gap-line"></span>
						</div>
					{:else if item.kind === 'skipped'}
						<div class="plan-block plan-block-skipped">
							<div class="plan-block-time">
								{isoToHHmm(item.block.started_at)}<br />{isoToHHmm(item.block.ended_at)}
							</div>
							<div class="plan-block-body">
								<div class="plan-block-name">{item.block.label}</div>
								<div class="plan-block-meta">
									<span>{formatTime(item.seconds)}</span>
									<span class="plan-block-verdict">
										· {item.workedThrough
											? 'worked through'
											: item.movedElsewhere
												? 'done at another time'
												: 'not done'}
									</span>
								</div>
							</div>
							<div class="plan-block-actions">
								<button
									class="btn-icon"
									onclick={() => openEdit(item.block)}
									aria-label="Edit block"
								>
									<Icon name="pen" />
								</button>
								<button
									class="btn-icon"
									onclick={() => board.deleteBlock(item.block)}
									aria-label="Delete block"
								>
									<Icon name="trash" />
								</button>
							</div>
						</div>
					{:else if item.kind === 'rest'}
						<div class="plan-block plan-block-free plan-block-rest">
							<div class="plan-block-time">
								{isoToHHmm(item.block.started_at)}<br />{isoToHHmm(item.block.ended_at)}
							</div>
							<div class="plan-block-body">
								<div class="plan-block-name">{item.block.label}</div>
								<div class="plan-block-meta">
									<span>{formatTime(item.seconds)}</span>
									<span class="plan-block-verdict">· as planned</span>
								</div>
							</div>
							<div class="plan-block-actions">
								<Icon name="check" class="plan-block-tick" />
							</div>
						</div>
					{:else if item.kind === 'actual'}
						{@const shortfall = item.plannedSeconds - item.seconds}
						<button
							class="plan-block plan-block-actual"
							class:plan-block-moved={item.offScheduleBlock !== null}
							class:plan-block-running={item.running}
							onclick={() => openEntry(item.entryId)}
						>
							<div class="plan-block-time">
								{isoToHHmm(item.startedAt)}<br />{item.running ? 'now' : isoToHHmm(item.endedAt)}
							</div>
							<div class="plan-block-body">
								<div class="plan-block-name">{item.taskName}</div>
								<div class="plan-block-meta">
									<span class="plan-block-actual-time">
										{item.block
											? `${formatTime(item.seconds)} / ${formatTime(item.plannedSeconds)}`
											: formatTime(item.seconds)}
									</span>
									{#if item.offScheduleBlock}
										<span class="plan-block-verdict">
											· planned for {isoToHHmm(item.offScheduleBlock.started_at)}
										</span>
									{:else if shortfall > 120 && !item.running}
										<!-- A running entry has not had its chance yet; calling it short is noise. -->
										<span class="plan-block-verdict plan-block-short">
											· {formatTime(shortfall)} short
										</span>
									{/if}
									{#if item.projectName}<span class="plan-block-project">· {item.projectName}</span
										>{/if}
									{#if item.comment}<span class="plan-block-note">· {item.comment}</span>{/if}
								</div>
							</div>
						</button>
					{:else if item.kind === 'planned'}
						{@const b = item.block}
						{@const finished = PlanBoard.isFinished(b)}
						<div
							class="plan-block"
							class:plan-block-free={b.task_id === null}
							class:plan-block-finished={finished}
							class:plan-block-current={item.current}
						>
							<div class="plan-block-time">
								{isoToHHmm(b.started_at)}<br />{isoToHHmm(b.ended_at)}
							</div>
							<div class="plan-block-body">
								<div class="plan-block-name">{b.label}</div>
								<div class="plan-block-meta">
									<span>
										{formatTime(item.remainingSeconds)}{item.current ? ' left' : ''}
									</span>
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
												<button
													class="btn-success btn-sm"
													onclick={() => handleTimerStopAndStart(b)}
												>
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
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

<PlanBlockEditor
	open={editorOpen}
	block={editingBlock}
	date={selectedDate}
	onclose={() => (editorOpen = false)}
	onsaved={refresh}
/>

<CommitmentsSheet open={commitmentsOpen} onclose={() => (commitmentsOpen = false)} />

<Modal open={alarm.alarmOpen} onclose={() => dismissAlarm()} narrow>
	<div class="plan-alarm">
		<div class="modal-title">Block started</div>
		{#if alarm.alarmBlock}
			<p class="plan-alarm-label">{alarm.alarmBlock.label}</p>
			<p class="plan-alarm-time">
				{isoToHHmm(alarm.alarmBlock.started_at)} – {isoToHHmm(alarm.alarmBlock.ended_at)}
			</p>
		{/if}
		<button class="btn btn-primary plan-alarm-dismiss" onclick={() => dismissAlarm(true)}
			>Dismiss</button
		>
	</div>
</Modal>
