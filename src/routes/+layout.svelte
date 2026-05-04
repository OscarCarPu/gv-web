<script lang="ts">
	import '$styles/app.css';
	import '$styles/components.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { setClientToken } from '$lib/shared/api/client';
	import ToastContainer from '$lib/shared/components/ToastContainer.svelte';
	import NotificationContainer from '$lib/shared/components/NotificationContainer.svelte';
	import { installLinkifyHandler } from '$lib/shared/utils/linkify';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { data, children } = $props();

	$effect(() => {
		setClientToken(data.token);
	});

	$effect(() => {
		installLinkifyHandler();
	});
</script>

{#if data.token || data.semiprivateToken}
	<header class="app-header">
		<nav class="app-nav">
			{#if data.token}
				<a href="/habits" class="nav-link" class:active={page.url.pathname.startsWith('/habits')}>Hábitos</a>
				<a href="/tasks" class="nav-link" class:active={page.url.pathname.startsWith('/tasks')}>Tareas</a>
			{/if}
			<a href="/weed" class="nav-link" class:active={page.url.pathname.startsWith('/weed')}>Maria</a>
		</nav>
		<form method="POST" action="/logout" use:enhance>
			<button type="submit" class="logout-btn" title="Logout">
				<Icon name="sign-out" />
			</button>
		</form>
	</header>
{/if}

<main>
	{@render children()}
</main>

<ToastContainer />
<NotificationContainer />
