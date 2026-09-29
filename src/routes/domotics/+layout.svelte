<script lang="ts">
	import '$styles/printers.css';
	import '$styles/domotics.css';
	import '$styles/uptime.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageTabs from '$lib/shared/components/PageTabs.svelte';

	let { children } = $props();

	const printers = resolve('/domotics/printers');
	const lights = resolve('/domotics/lights');
	const uptime = resolve('/domotics/uptime');
</script>

<svelte:head>
	<title>Domotics</title>
</svelte:head>

<div class="domotics-page">
	<header class="domotics-head">
		<h1>Domotics</h1>
		<PageTabs
			tabs={[
				{ value: printers, label: 'Printers', href: printers },
				{ value: lights, label: 'Lights', href: lights },
				{ value: uptime, label: 'Uptime', href: uptime },
			]}
			active={page.url.pathname}
		/>
	</header>

	{@render children()}
</div>
