<script lang="ts">
	import { enhance } from '$app/forms';
	import '$styles/login.css';

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

<div class="login-container">
	<form
		method="POST"
		action="?/login"
		use:enhance={() => {
			isLoading = true;
			return async ({ update }) => {
				isLoading = false;
				await update();
			};
		}}
	>
		<h1>Private Access</h1>

		{#if form?.message}
			<p class="error-message">{form.message}</p>
		{/if}

		<div class="form-group">
			<input
				type="password"
				name="password"
				placeholder="Password"
				required
				disabled={isLoading}
				autocomplete="current-password"
			/>
		</div>

		<button type="submit" disabled={isLoading}>
			{#if isLoading}
				<i class="fas fa-spinner fa-spin"></i>
				Verifying...
			{:else}
				Next
				<i class="fas fa-arrow-right"></i>
			{/if}
		</button>
	</form>
</div>
