<script lang="ts">
	import { page } from '$app/state';

	const unavailable = $derived(page.error?.code === 'unavailable_on_failover');
</script>

<svelte:head>
	<title>{unavailable ? 'Unavailable' : `Error ${page.status}`}</title>
</svelte:head>

<section class="error-page">
	<h1>{unavailable ? 'Unavailable right now' : `Error ${page.status}`}</h1>
	<p>{page.error?.message}</p>
	<a href="/">Home</a>
</section>

<style>
	.error-page {
		max-width: 32rem;
		margin: 4rem auto;
		padding: 0 1rem;
		text-align: center;
	}
</style>
