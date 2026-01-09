<script lang="ts">
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import '$styles/app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	const isAuthPage = $derived(
		$page.url.pathname.startsWith('/login') || $page.url.pathname === '/logout'
	);
</script>

{#if !isAuthPage}
	<form method="POST" action="/logout" class="logout-btn">
		<button type="submit" title="Logout">
			<i class="fas fa-sign-out-alt"></i>
		</button>
	</form>
{/if}

<main>
	{@render children()}
</main>
