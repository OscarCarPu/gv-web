<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<div class="min-h-screen bg-bg text-text">
	<nav class="bg-bg-light border-b border-slate-700">
		<div class="w-full px-6 py-3 flex gap-6">
			<a
				href="/"
				class="text-text-muted hover:text-primary font-medium transition-colors {page.url.pathname === '/' ? 'text-primary' : ''}"
			>
				Home
			</a>
			<a
				href="/habits"
				class="text-text-muted hover:text-primary font-medium transition-colors {page.url.pathname.startsWith('/habits') ? 'text-primary' : ''}"
			>
				Habits
			</a>
		</div>
	</nav>

	<main class="w-full px-6 py-8">
		{@render children()}
	</main>
</div>
