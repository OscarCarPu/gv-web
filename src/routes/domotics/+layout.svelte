<script lang="ts">
	import '$styles/printers.css';
	import '$styles/domotics.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children } = $props();

	const printers = resolve('/domotics/printers');
	const lights = resolve('/domotics/lights');
</script>

<svelte:head>
	<title>Domotics</title>
</svelte:head>

<div class="domotics-page">
	<header class="domotics-head">
		<h1>Domotics</h1>
		<nav class="domotics-tabs">
			<a href={printers} class="domotics-tab" class:active={page.url.pathname === printers}>
				Printers
			</a>
			<a href={lights} class="domotics-tab" class:active={page.url.pathname === lights}>Lights</a>
		</nav>
	</header>

	{@render children()}
</div>
