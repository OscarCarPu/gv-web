<script lang="ts">
	import { formatMoney } from '$shared/utils/money';
	import type { CategoryStat } from '../../types/Money.types';

	interface Props {
		data: CategoryStat[];
		variant?: 'income' | 'expense';
		max?: number;
	}

	let { data, variant = 'expense', max }: Props = $props();

	const visible = $derived(max != null ? data.slice(0, max) : data);

	const top = $derived.by(() => {
		const amounts = visible.map((d) => parseFloat(d.amount));
		return amounts.length ? Math.max(...amounts, 0.01) : 1;
	});
</script>

{#if visible.length === 0}
	<div class="chart-empty">No transactions in this period</div>
{:else}
	<ul class="cat-bars" class:cat-bars-income={variant === 'income'}>
		{#each visible as row (row.category_id ?? row.name)}
			{@const amount = parseFloat(row.amount)}
			{@const widthPct = top > 0 ? (amount / top) * 100 : 0}
			{@const sharePct = (row.share * 100).toFixed(1)}
			<li class="cat-bar">
				<div class="cat-bar-head">
					<span class="cat-bar-name">{row.name}</span>
					<span
						class="cat-bar-amount"
						class:amount-positive={variant === 'income'}
						class:amount-negative={variant === 'expense'}
					>
						{variant === 'income' ? '+' : '−'}{formatMoney(row.amount)}
					</span>
				</div>
				<div class="cat-bar-track">
					<div class="cat-bar-fill" style="width: {widthPct}%"></div>
				</div>
				<div class="cat-bar-foot">
					<span class="cat-bar-share">{sharePct}%</span>
				</div>
			</li>
		{/each}
	</ul>
{/if}
