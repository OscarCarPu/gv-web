<script lang="ts">
	import { enhance } from '$app/forms';
	import '$styles/login.css';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Sign In</title>
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
		<a href="/" class="back-link" title="Back">
			<Icon name="arrow-left" />
		</a>

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
				<Icon name="spinner" spin />
				Verifying...
			{:else}
				Next
				<Icon name="arrow-right" />
			{/if}
		</button>
	</form>
</div>
