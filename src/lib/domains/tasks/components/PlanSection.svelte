<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { formatTime, toLocalDateString, toISOString } from '$lib/shared/utils/datetime';
	import PlanBlockEditor from './PlanBlockEditor.svelte';
	import type { PlanTodayResponse, PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

	interface Props {
		initial: PlanTodayResponse | null;
		ontimerstart: (taskId: number, taskName: string, projectName?: string | null) => Promise<void>;
		onafterchange: () => Promise<void> | void;
		isTimerRunning: boolean;
	}

	let { initial, ontimerstart, onafterchange, isTimerRunning }: Props = $props();

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
		if (!isStarted(b)) return 'Empezar';
		return b.task_type === 'recurring' ? 'Renovar' : 'Acabar';
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
			const msg = e instanceof Error ? e.message : 'Error al borrar';
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
	// Future task work according to the plan: linked blocks whose start is now or later.
	const futureTaskSeconds = $derived.by(() => {
		if (!data) return 0;
		let s = 0;
		for (const b of data.blocks) {
			if (b.task_id === null) continue;
			if (new Date(b.started_at).getTime() < nowMs) continue;
			s += (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000;
		}
		return s;
	});
	const estimatedTotal = $derived(doneTodaySeconds + futureTaskSeconds);
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
</script>

<div class="tasks-section">
	<div class="section-header">
		<h2>Plan de hoy</h2>
		<button class="btn-primary btn-sm" onclick={openCreate}>
			<Icon name="plus" /> Bloque
		</button>
	</div>

	{#if data === null}
		<div class="history-empty">
			<Icon name="calendar-day" class="text-2xl" />
			<span>No se pudo cargar el plan</span>
		</div>
	{:else}
		<div class="plan-summary">
			<div class="plan-summary-row" class:goal-reached={estimatedReached}>
				<span class="plan-summary-label">Estim.</span>
				<div class="progress-track bg-bg">
					<div class="progress-fill" style="width: {estimatedPct}%"></div>
				</div>
				<span class="plan-summary-value">
					{formatTime(estimatedTotal)} / {formatTime(dailyTarget)}
				</span>
			</div>
			<div class="plan-summary-row">
				<span class="plan-summary-label">Libre</span>
				<span class="plan-summary-value">{formatTime(freeTotal)}</span>
			</div>
		</div>

		{#if data.blocks.length === 0}
			<div class="history-empty">
				<Icon name="calendar-day" class="text-2xl" />
				<span>Sin bloques para hoy</span>
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
								<button
									class="btn-primary btn-sm"
									onclick={() => handleToggle(b)}
									disabled={finished}
								>
									{toggleLabel(b)}
								</button>
								<button class="btn-primary btn-sm" onclick={() => handleTimer(b)}>
									<Icon name={isTimerRunning ? 'arrow-right' : 'play'} />
									{isTimerRunning ? 'Asignar' : 'Iniciar'}
								</button>
							{/if}
							<button class="btn-icon" onclick={() => openEdit(b)} aria-label="Editar bloque">
								<Icon name="pen" />
							</button>
							<button class="btn-icon" onclick={() => handleDelete(b)} aria-label="Borrar bloque">
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
