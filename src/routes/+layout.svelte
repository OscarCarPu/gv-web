<script lang="ts">
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import '$styles/app.css';
	import { setClientToken } from '$lib/shared/api/client';

	let { data, children } = $props();

	$effect(() => {
		setClientToken(data.token);
	});
</script>

<main>
	{@render children()}
</main>
