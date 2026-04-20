<script lang="ts">
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import '$styles/app.css';
	import '$styles/components.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { setClientToken } from '$lib/shared/api/client';
	import ToastContainer from '$lib/shared/components/ToastContainer.svelte';
	import NotificationContainer from '$lib/shared/components/NotificationContainer.svelte';

	let { data, children } = $props();

	$effect(() => {
		setClientToken(data.token);
	});
</script>

{#if data.token}
	<header class="app-header">
		<nav class="app-nav">
			<a href="/habits" class="nav-link" class:active={page.url.pathname.startsWith('/habits')}>Hábitos</a>
			<a href="/tasks" class="nav-link" class:active={page.url.pathname.startsWith('/tasks')}>Tareas</a>
		</nav>
		<form method="POST" action="/logout" use:enhance>
			<button type="submit" class="logout-btn" title="Logout">
				<i class="fas fa-sign-out-alt"></i>
			</button>
		</form>
	</header>
{/if}

<main>
	{@render children()}
</main>

<ToastContainer />
<NotificationContainer />
