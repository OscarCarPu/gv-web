<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { formatTime, isoToHHmm } from '$lib/shared/utils/datetime';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { PlanBoard } from '$lib/domains/tasks/planBoard.svelte';
	import {
		HOUR_MS,
		agendaRange,
		blockSpan,
		conflictIds,
		dragSpan,
		hourMarks,
		layoutLanes,
		mergeCandidate,
		planSaveSteps,
		sameSpan,
		splitPoint,
		type AgendaDragMode,
		type AgendaRange,
		type Span,
	} from '$lib/domains/tasks/utils/planAgenda';
	import type { PlanBlockResponse } from '$lib/domains/tasks/types/Plan.types';

	interface Props {
		board: PlanBoard;
		onedit: (b: PlanBlockResponse) => void;
	}

	let { board, onedit }: Props = $props();

	const HOUR_PX = 56;
	/** Pointer travel before a press on a block counts as a move rather than a click. */
	const MOVE_THRESHOLD_PX = 4;

	// ── draft ───────────────────────────────────────────────────────────
	//
	// Drags only change the draft; nothing reaches the API until Save. Each entry remembers the
	// server times it was drafted against (`base`): when the server's times for that block change
	// underneath it (the editor saved it, a refresh brought someone else's change), the entry is
	// stale and ignored — the server wins.

	let draft = $state<Record<number, { span: Span; base: Span }>>({});

	const serverBlocks = $derived(board.data?.blocks ?? []);

	function draftFor(b: PlanBlockResponse): Span | null {
		const d = draft[b.id];
		return d && sameSpan(d.base, blockSpan(b)) ? d.span : null;
	}

	interface Drag {
		id: number;
		mode: AgendaDragMode;
		originY: number;
		origin: Span;
		/** The grid is frozen for the whole drag — recomputing it mid-drag would shift the
		 *  pixel origin under the pointer. */
		range: AgendaRange;
		value: Span;
		moved: boolean;
	}

	let drag = $state<Drag | null>(null);
	let busy = $state(false);
	/** Releasing an edge fires a click on the block (the handle is inside it) — swallow it so
	 *  the editor does not open. */
	let swallowClick = false;

	/** What the grid shows: server times, overridden by the draft, overridden by a live drag. */
	const items = $derived(
		serverBlocks
			.map((b) => {
				const server = blockSpan(b);
				const drafted = draftFor(b);
				const span = drag?.id === b.id && drag.moved ? drag.value : (drafted ?? server);
				return { block: b, span, server, dirty: !sameSpan(drafted ?? server, server) };
			})
			.sort((a, b) => a.span.startMs - b.span.startMs)
	);

	const idSpans = $derived(items.map((it) => ({ id: it.block.id, ...it.span })));
	const conflicts = $derived(conflictIds(idSpans));
	const lanes = $derived(layoutLanes(idSpans));
	const dirtyCount = $derived(items.filter((it) => it.dirty).length);

	const liveRange = $derived(
		agendaRange(
			items.map((it) => it.span),
			board.nowMs
		)
	);
	const range = $derived(drag?.range ?? liveRange);
	const marks = $derived(hourMarks(range));

	function toPx(ms: number): number {
		return ((ms - range.startMs) / HOUR_MS) * HOUR_PX;
	}

	/** The block as the editor should see it: with its drafted times. */
	function withSpan(b: PlanBlockResponse, span: Span): PlanBlockResponse {
		return {
			...b,
			started_at: new Date(span.startMs).toISOString(),
			ended_at: new Date(span.endMs).toISOString(),
		};
	}

	// ── drag (edges resize, the body moves) ─────────────────────────────

	function beginDrag(e: PointerEvent, it: (typeof items)[number], mode: AgendaDragMode) {
		if (busy || e.button !== 0) return;
		e.stopPropagation();
		if (mode !== 'move') {
			// An edge is a drag from the first pixel; the body waits for the threshold so a
			// plain click still opens the editor.
			e.preventDefault();
			swallowClick = true;
		}
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = {
			id: it.block.id,
			mode,
			originY: e.clientY,
			origin: it.span,
			range,
			value: it.span,
			moved: mode !== 'move',
		};
	}

	function moveDrag(e: PointerEvent) {
		if (!drag) return;
		const dy = e.clientY - drag.originY;
		if (!drag.moved) {
			if (Math.abs(dy) < MOVE_THRESHOLD_PX) return;
			drag.moved = true;
			swallowClick = true;
		}
		drag.value = dragSpan(drag.origin, drag.mode, (dy / HOUR_PX) * HOUR_MS, drag.range);
	}

	function endDrag() {
		releaseClick();
		if (!drag) return;
		const d = drag;
		drag = null;
		if (!d.moved || sameSpan(d.value, d.origin)) return;
		const b = serverBlocks.find((x) => x.id === d.id);
		if (!b) return;
		const server = blockSpan(b);
		if (sameSpan(d.value, server)) {
			delete draft[d.id];
		} else {
			draft[d.id] = { span: d.value, base: server };
		}
	}

	function cancelDrag() {
		releaseClick();
		drag = null;
	}

	/** The click (if any) follows pointerup synchronously; after that the flag must not linger
	 *  or it would eat the next real click. */
	function releaseClick() {
		setTimeout(() => (swallowClick = false));
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		try {
			await action();
		} finally {
			busy = false;
		}
	}

	// ── save / discard ──────────────────────────────────────────────────

	function discard() {
		draft = {};
	}

	function save() {
		const steps = planSaveSteps(
			serverBlocks.map((b) => ({ id: b.id, ...blockSpan(b) })),
			idSpans
		);
		if (steps === null) {
			addToast('Some blocks overlap — fix them before saving', 'error');
			return;
		}
		run(async () => {
			if (await board.saveTimes(steps)) {
				draft = {};
				return;
			}
			// Part of it went through (maybe a block is sitting in a parking minute). Re-anchor
			// what is left to the server's new times so the draft is not dropped as stale and
			// Save can simply be pressed again.
			for (const b of serverBlocks) {
				const d = draft[b.id];
				if (d) d.base = blockSpan(b);
			}
		});
	}

	$effect(() => {
		if (dirtyCount === 0) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});

	// ── context menu ────────────────────────────────────────────────────

	let menu = $state<{ x: number; y: number; id: number } | null>(null);
	let menuEl = $state<HTMLElement | null>(null);

	function openMenu(e: MouseEvent, id: number) {
		e.preventDefault();
		if (busy || drag) return;
		menu = { x: e.clientX, y: e.clientY, id };
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

	const menuIndex = $derived(menu ? items.findIndex((it) => it.block.id === menu!.id) : -1);
	const menuItem = $derived(menuIndex === -1 ? null : items[menuIndex]);
	const menuMergeNext = $derived.by(() => {
		if (menuIndex === -1) return null;
		const next = mergeCandidate(
			items.map((it) => it.block),
			menuIndex
		);
		return next ? items[menuIndex + 1] : null;
	});
	/** Split and merge work on the server's times; with unsaved changes on either block they
	 *  would act on something the user no longer sees. */
	const menuLocked = $derived(!!menuItem?.dirty || !!menuMergeNext?.dirty);

	/** Snapshot the targets before closing: they are derived from `menu`, so reading them after
	 *  `closeMenu()` would give null. */
	function menuAction(
		action: (b: PlanBlockResponse, next: PlanBlockResponse | null) => Promise<void> | void
	) {
		const b = menuItem?.block ?? null;
		const next = menuMergeNext?.block ?? null;
		closeMenu();
		if (b) run(async () => action(b, next));
	}

	function editFromMenu() {
		const it = menuItem;
		closeMenu();
		if (it) onedit(withSpan(it.block, it.span));
	}

	async function deleteBlock(b: PlanBlockResponse) {
		await board.deleteBlock(b);
		delete draft[b.id];
	}
</script>

<svelte:window
	onpointerdown={onWindowPointerDown}
	onkeydown={onWindowKeydown}
	onscroll={closeMenu}
	onresize={closeMenu}
/>

<div class="plan-agenda" class:dragging={drag?.moved} class:busy>
	{#if dirtyCount > 0}
		<div class="plan-agenda-savebar" class:has-conflicts={conflicts.size > 0}>
			<span class="plan-agenda-savebar-text">
				{#if conflicts.size > 0}
					<Icon name="circle-exclamation" />
					{conflicts.size} blocks overlap
				{:else}
					{dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
				{/if}
			</span>
			<button class="btn-outline btn-sm" onclick={discard} disabled={busy}>Discard</button>
			<button class="btn-primary btn-sm" onclick={save} disabled={busy || conflicts.size > 0}>
				<Icon name="check" /> Save
			</button>
		</div>
	{/if}

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

		{#each items as it (it.block.id)}
			{@const b = it.block}
			{@const span = it.span}
			{@const heightPx = toPx(span.endMs) - toPx(span.startMs)}
			{@const lane = lanes.get(b.id) ?? { lane: 0, lanes: 1 }}
			<div
				class="plan-agenda-block"
				class:plan-agenda-free={b.task_id === null}
				class:plan-agenda-current={board.currentBlock?.id === b.id && !it.dirty}
				class:plan-agenda-past={span.endMs <= board.nowMs}
				class:plan-agenda-finished={PlanBoard.isFinished(b)}
				class:plan-agenda-short={heightPx < 34}
				class:plan-agenda-dirty={it.dirty}
				class:plan-agenda-conflict={conflicts.has(b.id)}
				class:plan-agenda-active={drag?.id === b.id || menu?.id === b.id}
				style="top: {toPx(
					span.startMs
				)}px; height: {heightPx}px; --lane: {lane.lane}; --lanes: {lane.lanes}"
				role="button"
				tabindex="0"
				onpointerdown={(e) => beginDrag(e, it, 'move')}
				onpointermove={moveDrag}
				onpointerup={endDrag}
				onpointercancel={cancelDrag}
				onclick={() => {
					if (swallowClick) swallowClick = false;
					else onedit(withSpan(b, span));
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') onedit(withSpan(b, span));
				}}
				oncontextmenu={(e) => openMenu(e, b.id)}
			>
				<div
					class="plan-agenda-handle plan-agenda-handle-start"
					aria-hidden="true"
					onpointerdown={(e) => beginDrag(e, it, 'start')}
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
					onpointerdown={(e) => beginDrag(e, it, 'end')}
					onpointermove={moveDrag}
					onpointerup={endDrag}
					onpointercancel={cancelDrag}
				></div>
			</div>
		{/each}
	</div>
</div>

{#if menu && menuItem}
	<div
		class="plan-agenda-menu"
		role="menu"
		bind:this={menuEl}
		style="left: {menu.x}px; top: {menu.y}px"
	>
		<button role="menuitem" onclick={editFromMenu}>
			<Icon name="pen" /> Edit
		</button>
		<button
			role="menuitem"
			disabled={menuLocked || splitPoint(menuItem.block) === null}
			title={menuLocked ? 'Save or discard your changes first' : undefined}
			onclick={() => menuAction((b) => board.splitBlock(b))}
		>
			<Icon name="compress" /> Split in two
		</button>
		{#if menuMergeNext}
			<button
				role="menuitem"
				disabled={menuLocked}
				title={menuLocked ? 'Save or discard your changes first' : undefined}
				onclick={() => menuAction((b, next) => (next ? board.mergeBlocks(b, next) : undefined))}
			>
				<Icon name="expand" /> Merge with next
			</button>
		{/if}
		<button role="menuitem" class="plan-agenda-menu-danger" onclick={() => menuAction(deleteBlock)}>
			<Icon name="trash" /> Delete
		</button>
	</div>
{/if}
