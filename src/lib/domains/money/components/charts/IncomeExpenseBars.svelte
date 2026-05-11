<script lang="ts">
	import { formatMoney } from '$shared/utils/money';
	import type { MonthlyStat } from '../../types/Money.types';

	interface Props {
		data: MonthlyStat[];
		height?: number;
	}

	let { data, height = 220 }: Props = $props();

	const monthNames = [
		'Ene',
		'Feb',
		'Mar',
		'Abr',
		'May',
		'Jun',
		'Jul',
		'Ago',
		'Sep',
		'Oct',
		'Nov',
		'Dic',
	];

	function monthLabel(m: string): string {
		const [y, mm] = m.split('-');
		const idx = parseInt(mm, 10) - 1;
		if (idx < 0 || idx > 11) return m;
		return `${monthNames[idx]} ${y.slice(2)}`;
	}

	const max = $derived.by(() => {
		if (data.length === 0) return 1;
		const vals = data.flatMap((d) => [parseFloat(d.income), parseFloat(d.expense)]);
		return Math.max(...vals, 1);
	});

	let hovered = $state<number | null>(null);
	let containerWidth = $state(600);

	const padding = { top: 16, right: 8, bottom: 30, left: 56 };
	const innerHeight = $derived(height - padding.top - padding.bottom);
	const innerWidth = $derived(Math.max(0, containerWidth - padding.left - padding.right));

	function shortMoney(v: number): string {
		const abs = Math.abs(v);
		if (abs >= 1000) {
			const k = v / 1000;
			const decimals = abs >= 10000 ? 0 : 1;
			return `${k.toFixed(decimals)}k`;
		}
		return Math.round(v).toString();
	}

	const yTicks = $derived.by(() => {
		const step = max / 4;
		return [0, step, step * 2, step * 3, max];
	});

	const labelStride = $derived.by(() => {
		if (innerWidth <= 0 || data.length === 0) return 1;
		const slotW = innerWidth / data.length;
		const minPx = 38;
		return Math.max(1, Math.ceil(minPx / slotW));
	});

	type Point = { x: number; y: number };

	const seriesPoints = $derived.by((): { income: Point[]; expense: Point[] } => {
		if (data.length === 0 || innerWidth <= 0) return { income: [], expense: [] };
		const slotW = innerWidth / data.length;
		const barW = Math.max(2, Math.min(18, (slotW - 4) / 2));
		const gap = 2;
		const groupW = barW * 2 + gap;
		const income: Point[] = [];
		const expense: Point[] = [];
		for (let i = 0; i < data.length; i++) {
			const slotX = padding.left + slotW * i;
			const groupX = slotX + (slotW - groupW) / 2;
			const incH = (parseFloat(data[i].income) / max) * innerHeight;
			const expH = (parseFloat(data[i].expense) / max) * innerHeight;
			income.push({ x: groupX + barW / 2, y: padding.top + innerHeight - incH });
			expense.push({ x: groupX + barW + gap + barW / 2, y: padding.top + innerHeight - expH });
		}
		return { income, expense };
	});

	function pointsAttr(pts: Point[]): string {
		return pts.map((p) => `${p.x},${p.y}`).join(' ');
	}

	const hoveredPos = $derived.by(() => {
		if (hovered == null || !data[hovered] || innerWidth <= 0) return null;
		const slotW = innerWidth / data.length;
		const slotX = padding.left + slotW * hovered;
		const centerX = slotX + slotW / 2;
		const incH = (parseFloat(data[hovered].income) / max) * innerHeight;
		const expH = (parseFloat(data[hovered].expense) / max) * innerHeight;
		const topY = padding.top + innerHeight - Math.max(incH, expH);
		return { centerX, topY };
	});

	const TOOLTIP_W = 200;
	const TOOLTIP_H_EST = 130;

	const tooltipLeft = $derived.by(() => {
		if (!hoveredPos) return 0;
		const desired = hoveredPos.centerX - TOOLTIP_W / 2;
		const minLeft = 4;
		const maxLeft = containerWidth - TOOLTIP_W - 4;
		return Math.max(minLeft, Math.min(maxLeft, desired));
	});

	const tooltipTop = $derived.by(() => {
		if (!hoveredPos) return 0;
		const above = hoveredPos.topY - TOOLTIP_H_EST - 8;
		if (above >= 4) return above;
		return hoveredPos.topY + 12;
	});
</script>

{#if data.length === 0}
	<div class="chart-empty">Sin datos para este rango</div>
{:else}
	<div class="ie-bars" style="height: {height}px" bind:clientWidth={containerWidth}>
		<svg
			width={containerWidth}
			{height}
			class="ie-svg"
			role="img"
			aria-label="Ingresos vs gastos por mes"
		>
			{#each yTicks as t (t)}
				{@const y = padding.top + innerHeight - (t / max) * innerHeight}
				<line
					x1={padding.left}
					x2={containerWidth - padding.right}
					y1={y}
					y2={y}
					stroke="var(--color-text-muted)"
					opacity="0.1"
				/>
				<text
					x={padding.left - 8}
					{y}
					text-anchor="end"
					dominant-baseline="middle"
					font-size="11"
					fill="var(--color-text-muted)"
				>
					{shortMoney(t)}
				</text>
			{/each}

			{#each data as d, i (d.month)}
				{@const slotW = innerWidth / data.length}
				{@const slotX = padding.left + slotW * i}
				{@const barW = Math.max(2, Math.min(18, (slotW - 4) / 2))}
				{@const gap = 2}
				{@const groupW = barW * 2 + gap}
				{@const groupX = slotX + (slotW - groupW) / 2}
				{@const incH = (parseFloat(d.income) / max) * innerHeight}
				{@const expH = (parseFloat(d.expense) / max) * innerHeight}
				{@const incY = padding.top + innerHeight - incH}
				{@const expY = padding.top + innerHeight - expH}
				{@const isHovered = hovered === i}
				{@const showLabel = i % labelStride === 0 || i === data.length - 1}

				<g
					role="button"
					tabindex="0"
					onmouseenter={() => (hovered = i)}
					onmouseleave={() => (hovered = null)}
					onfocus={() => (hovered = i)}
					onblur={() => (hovered = null)}
				>
					<rect x={slotX} y={padding.top} width={slotW} height={innerHeight} fill="transparent" />
					<rect
						x={groupX}
						y={incY}
						width={barW}
						height={incH}
						fill="var(--color-success)"
						opacity={isHovered ? 1 : 0.85}
						rx="2"
					/>
					<rect
						x={groupX + barW + gap}
						y={expY}
						width={barW}
						height={expH}
						fill="var(--color-danger)"
						opacity={isHovered ? 1 : 0.85}
						rx="2"
					/>
					{#if showLabel}
						<text
							x={slotX + slotW / 2}
							y={padding.top + innerHeight + 18}
							text-anchor="middle"
							font-size="11"
							fill="var(--color-text-muted)"
						>
							{monthLabel(d.month)}
						</text>
					{/if}
				</g>
			{/each}

			<line
				x1={padding.left}
				x2={containerWidth - padding.right}
				y1={padding.top + innerHeight}
				y2={padding.top + innerHeight}
				stroke="var(--color-text-muted)"
				opacity="0.2"
			/>

			{#if seriesPoints.income.length > 1}
				<polyline
					points={pointsAttr(seriesPoints.income)}
					fill="none"
					stroke="var(--color-success)"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.9"
				/>
			{/if}
			{#if seriesPoints.expense.length > 1}
				<polyline
					points={pointsAttr(seriesPoints.expense)}
					fill="none"
					stroke="var(--color-danger)"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.9"
				/>
			{/if}
			{#each seriesPoints.income as p, i (i)}
				<circle cx={p.x} cy={p.y} r="2.5" fill="var(--color-success)" />
			{/each}
			{#each seriesPoints.expense as p, i (i)}
				<circle cx={p.x} cy={p.y} r="2.5" fill="var(--color-danger)" />
			{/each}
		</svg>

		{#if hovered != null && data[hovered]}
			{@const d = data[hovered]}
			<div class="ie-tooltip" style="left: {tooltipLeft}px; top: {tooltipTop}px">
				<div class="ie-tooltip-month">{monthLabel(d.month)}</div>
				<div class="ie-tooltip-row">
					<span class="ie-dot ie-dot-income"></span>
					<span>Ingresos</span>
					<span class="amount-positive">+{formatMoney(d.income)}</span>
				</div>
				<div class="ie-tooltip-row">
					<span class="ie-dot ie-dot-expense"></span>
					<span>Gastos</span>
					<span class="amount-negative">−{formatMoney(d.expense)}</span>
				</div>
				<div class="ie-tooltip-row ie-tooltip-balance">
					<span>Balance</span>
					<span
						class:amount-positive={parseFloat(d.balance) > 0}
						class:amount-negative={parseFloat(d.balance) < 0}
					>
						{parseFloat(d.balance) >= 0 ? '+' : '−'}{formatMoney(
							Math.abs(parseFloat(d.balance)).toFixed(2)
						)}
					</span>
				</div>
				{#if parseFloat(d.income) > 0}
					{@const savingsPct = (parseFloat(d.balance) / parseFloat(d.income)) * 100}
					<div class="ie-tooltip-row">
						<span>Ahorro</span>
						<span class:amount-positive={savingsPct > 0} class:amount-negative={savingsPct < 0}>
							{savingsPct >= 0 ? '+' : '−'}{Math.abs(savingsPct).toFixed(1)}%
						</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="ie-legend">
		<span class="ie-legend-item"><span class="ie-dot ie-dot-income"></span> Ingresos</span>
		<span class="ie-legend-item"><span class="ie-dot ie-dot-expense"></span> Gastos</span>
	</div>
{/if}
