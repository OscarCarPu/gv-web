<script lang="ts">
	import { enhance } from '$app/forms';
	import '$styles/components.css';
	import '$styles/habits.css';

	let { children } = $props();
</script>

<header class="app-header">
	<form method="POST" action="/logout" use:enhance>
		<button type="submit" class="logout-btn" title="Logout">
			<i class="fas fa-sign-out-alt"></i>
		</button>
	</form>
</header>

{@render children()}
