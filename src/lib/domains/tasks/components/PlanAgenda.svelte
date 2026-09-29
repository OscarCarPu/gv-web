<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatTime, isoToHHmm } from '$lib/shared/utils/datetime';
	import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
	import {
		HOUR_MS,
		agendaRange,
		edgeLimits,
		hourMarks,
		mergeCandidate,
		resolveEdge,
		sortBlocks,
		splitPoint,
		type AgendaEdge,
	} from '$lib/domains/tasks/utils/planAgenda';
	import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

	interface Props {
		board: PlanBoard;
		onedit: (b: PlanBlockResponse) => void;
	}

	let { board, onedit }: Props = $props();

	const HOUR_PX = 56;

	const sorted = $derived(sortBlocks(board.data?.blocks ?? []));
	const range = $derived(agendaRange(sorted, board.nowMs));
	const marks = $derived(hourMarks(range));

	function toPx(ms: number): number {
		return ((ms - range.startMs) / HOUR_MS) * HOUR_PX;
	}

	// ── edge drag ───────────────────────────────────────────────────────

	interface Drag {
		index: number;
		edge: AgendaEdge;
		originY: number;
		originMs: number;
		limits: { min: number; max: number };
		valueMs: number;
	}

	let drag = $state<Drag | null>(null);
	/** Times a dropped edge is shown at until the refreshed plan arrives, so the block does not
	 *  snap back for the length of the round-trip. */
	let pending = $state<{ id: number; startMs: number; endMs: number } | null>(null);
	let busy = $state(false);
	/** The click that ends a drag lands on the block (the handle is inside it) — swallow it so
	 *  releasing an edge does not open the editor. */
	let swallowClick = false;

	function spanOf(b: PlanBlockResponse, i: number): { startMs: number; endMs: number } {
		let startMs = new Date(b.started_at).getTime();
		let endMs = new Date(b.ended_at).getTime();
		if (pending?.id === b.id) ({ startMs, endMs } = pending);
		if (drag?.index === i) {
			if (drag.edge === 'start') startMs = drag.valueMs;
			else endMs = drag.valueMs;
		}
		return { startMs, endMs };
	}

	function beginDrag(e: PointerEvent, index: number, edge: AgendaEdge) {
		if (busy || e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		swallowClick = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const b = sorted[index];
		const originMs = new Date(edge === 'start' ? b.started_at : b.ended_at).getTime();
		drag = {
			index,
			edge,
			originY: e.clientY,
			originMs,
			limits: edgeLimits(sorted, index, edge, range),
			valueMs: originMs,
		};
	}

	function moveDrag(e: PointerEvent) {
		if (!drag) return;
		const deltaMs = ((e.clientY - drag.originY) / HOUR_PX) * HOUR_MS;
		drag.valueMs = resolveEdge(drag.originMs + deltaMs, drag.limits);
	}

	/** The click (if any) follows pointerup synchronously; after that the flag must not linger
	 *  or it would eat the next real click. */
	function releaseClick() {
		setTimeout(() => (swallowClick = false));
	}

	async function endDrag() {
		releaseClick();
		if (!drag) return;
		const d = drag;
		drag = null;
		if (d.valueMs === d.originMs) return;
		const b = sorted[d.index];
		const startMs = d.edge === 'start' ? d.valueMs : new Date(b.started_at).getTime();
		const endMs = d.edge === 'end' ? d.valueMs : new Date(b.ended_at).getTime();
		pending = { id: b.id, startMs, endMs };
		await run(() => board.resizeBlock(b, startMs, endMs));
		pending = null;
	}

	function cancelDrag() {
		releaseClick();
		drag = null;
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} finally {
			busy = false;
		}
	}

	// ── context menu ────────────────────────────────────────────────────

	let menu = $state<{ x: number; y: number; index: number } | null>(null);
	let menuEl = $state<HTMLElement | null>(null);

	function openMenu(e: MouseEvent, index: number) {
		e.preventDefault();
		if (busy) return;
		menu = { x: e.clientX, y: e.clientY, index };
	}

	function closeMenu() {
		menu = null;
	}

	// Keep the menu on screen: flip it left/up when it would spill past the viewport edge.
	$effect(() => {
		if (!menu || !menuEl) return;
		const r = menuEl.getBoundingClientRect();
		const x = Math.min(menu.x, window.innerWidth - r.width - 8);
		const y = Math.min(menu.y, window.innerHeight - r.height - 8);
		menuEl.style.left = `${Math.max(8, x)}px`;
		menuEl.style.top = `${Math.max(8, y)}px`;
	});

	function onWindowPointerDown(e: PointerEvent) {
		if (menu && menuEl && !menuEl.contains(e.target as Node)) closeMenu();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeMenu();
			cancelDrag();
		}
	}

	const menuBlock = $derived(menu ? sorted[menu.index] : null);
	const menuMergeNext = $derived(menu ? mergeCandidate(sorted, menu.index) : null);

	/** Snapshot the target (and its merge partner) before closing: both are derived from `menu`,
	 *  so reading them after `closeMenu()` would give null. */
	function menuAction(
		action: (b: PlanBlockResponse, next: PlanBlockResponse | null) => Promise<void> | void
	) {
		const b = menuBlock;
		const next = menuMergeNext;
		closeMenu();
		if (b) run(async () => action(b, next));
	}
</script>

<svelte:window
	onpointerdown={onWindowPointerDown}
	onkeydown={onWindowKeydown}
	onscroll={closeMenu}
	onresize={closeMenu}
/>

<div class="plan-agenda" class:dragging={drag !== null} class:busy>
	<div class="plan-agenda-grid" style="height: {toPx(range.endMs)}px">
		{#each marks as m (m)}
			<div class="plan-agenda-hour" style="top: {toPx(m)}px">
				<span class="plan-agenda-hour-label">{isoToHHmm(m)}</span>
			</div>
		{/each}

		{#if board.nowMs >= range.startMs && board.nowMs <= range.endMs}
			<div class="plan-agenda-now" style="top: {toPx(board.nowMs)}px">
				<span class="plan-agenda-now-label">{isoToHHmm(board.nowMs)}</span>
			</div>
		{/if}

		{#each sorted as b, i (b.id)}
			{@const span = spanOf(b, i)}
			{@const heightPx = toPx(span.endMs) - toPx(span.startMs)}
			<div
				class="plan-agenda-block"
				class:plan-agenda-free={b.task_id === null}
				class:plan-agenda-current={board.currentBlock?.id === b.id}
				class:plan-agenda-past={span.endMs <= board.nowMs}
				class:plan-agenda-finished={PlanBoard.isFinished(b)}
				class:plan-agenda-short={heightPx < 34}
				class:plan-agenda-active={drag?.index === i || menu?.index === i}
				style="top: {toPx(span.startMs)}px; height: {heightPx}px"
				role="button"
				tabindex="0"
				onclick={() => {
					if (swallowClick) swallowClick = false;
					else onedit(b);
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') onedit(b);
				}}
				oncontextmenu={(e) => openMenu(e, i)}
			>
				<div
					class="plan-agenda-handle plan-agenda-handle-start"
					aria-hidden="true"
					onpointerdown={(e) => beginDrag(e, i, 'start')}
					onpointermove={moveDrag}
					onpointerup={endDrag}
					onpointercancel={cancelDrag}
				></div>
				<div class="plan-agenda-body">
					<span class="plan-agenda-name">{b.label}</span>
					<span class="plan-agenda-time">
						{isoToHHmm(span.startMs)}–{isoToHHmm(span.endMs)} · {formatTime(
							(span.endMs - span.startMs) / 1000
						)}
					</span>
					{#if b.note}<span class="plan-agenda-note">{b.note}</span>{/if}
				</div>
				<div
					class="plan-agenda-handle plan-agenda-handle-end"
					aria-hidden="true"
					onpointerdown={(e) => beginDrag(e, i, 'end')}
					onpointermove={moveDrag}
					onpointerup={endDrag}
					onpointercancel={cancelDrag}
				></div>
			</div>
		{/each}
	</div>
</div>

{#if menu && menuBlock}
	<div
		class="plan-agenda-menu"
		role="menu"
		bind:this={menuEl}
		style="left: {menu.x}px; top: {menu.y}px"
	>
		<button role="menuitem" onclick={() => menuAction(onedit)}>
			<Icon name="pen" /> Edit
		</button>
		<button
			role="menuitem"
			disabled={splitPoint(menuBlock) === null}
			onclick={() => menuAction((b) => board.splitBlock(b))}
		>
			<Icon name="compress" /> Split in two
		</button>
		{#if menuMergeNext}
			<button
				role="menuitem"
				onclick={() => menuAction((b, next) => (next ? board.mergeBlocks(b, next) : undefined))}
			>
				<Icon name="expand" /> Merge with next
			</button>
		{/if}
		<button
			role="menuitem"
			class="plan-agenda-menu-danger"
			onclick={() => menuAction((b) => board.deleteBlock(b))}
		>
			<Icon name="trash" /> Delete
		</button>
	</div>
{/if}
