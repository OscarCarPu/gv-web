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
	import { getTheme, toggleTheme, initTheme } from '$lib/shared/stores/theme.svelte';

	let { data, children } = $props();

	$effect(() => {
		setClientToken(data.token ?? data.semiprivateToken);
	});

	$effect(() => {
		installLinkifyHandler();
	});

	$effect(() => {
		initTheme();
	});
</script>

{#if data.token || data.semiprivateToken || page.url.pathname === '/'}
	<header class="app-header">
		<nav class="app-nav">
			{#if data.token}
				<a href="/habits" class="nav-link" class:active={page.url.pathname.startsWith('/habits')}
					>Habits</a
				>
				<a href="/tasks" class="nav-link" class:active={page.url.pathname.startsWith('/tasks')}
					>Tasks</a
				>
				<a href="/money" class="nav-link" class:active={page.url.pathname.startsWith('/money')}
					>Money</a
				>
				<a href="/rutas" class="nav-link" class:active={page.url.pathname.startsWith('/rutas')}
					>Routes</a
				>
			{/if}
			{#if data.token || data.semiprivateToken}
				<a
					href="/varieties"
					class="nav-link"
					class:active={page.url.pathname.startsWith('/varieties')}>Varieties</a
				>
			{/if}
		</nav>
		<div class="header-actions">
			<button
				type="button"
				class="home-btn"
				title={getTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				onclick={toggleTheme}
			>
				<Icon name={getTheme() === 'dark' ? 'sun' : 'moon'} />
			</button>
			{#if data.token || data.semiprivateToken}
				<a href="/" class="home-btn" title="Home">
					<Icon name="house" />
				</a>
				<form method="POST" action="/logout" use:enhance>
					<button type="submit" class="logout-btn" title="Logout">
						<Icon name="sign-out" />
					</button>
				</form>
			{:else}
				<a href="/login" class="logout-btn" title="Login">
					<Icon name="lock" />
				</a>
			{/if}
		</div>
	</header>
{/if}

<main>
	{@render children()}
</main>

<ToastContainer />
<NotificationContainer />
