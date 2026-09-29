<script lang="ts">
	import '$styles/tasks.css';
	import '$styles/money.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageTabs from '$lib/shared/components/PageTabs.svelte';

	let { children } = $props();

	const overview = resolve('/money');
	const budgets = resolve('/money/budgets');
</script>

<div class="container">
	<h1>Money</h1>
	<PageTabs
		tabs={[
			{ value: overview, label: 'Overview', href: overview },
			{ value: budgets, label: 'Budgets', href: budgets },
		]}
		active={page.url.pathname}
	/>

	{@render children()}
</div>
