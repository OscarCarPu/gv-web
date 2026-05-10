<script lang="ts">
	import OverviewCard from '$lib/domains/money/components/OverviewCard.svelte';
	import AccountsCard from '$lib/domains/money/components/AccountsCard.svelte';
	import CategoriesCard from '$lib/domains/money/components/CategoriesCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dinero</title>
</svelte:head>

<div class="container">
	<h1>Dinero</h1>

	<div class="money-content">
		<OverviewCard overview={data.overview} accounts={data.accounts} categories={data.categories} />

		<div class="money-side">
			<AccountsCard accounts={data.accounts} />
			<CategoriesCard categories={data.categories} />
		</div>
	</div>
</div>
