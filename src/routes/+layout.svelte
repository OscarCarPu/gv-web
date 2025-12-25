<script lang="ts">
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import '../styles/app.css';

	let { children } = $props();
</script>

<main>
	{@render children()}
</main>
