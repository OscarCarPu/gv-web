<script lang="ts">
	import BudgetsCard from '$lib/domains/money/components/BudgetsCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Budgets · Money</title>
</svelte:head>

<BudgetsCard budgets={data.budgets} categories={data.categories} />
