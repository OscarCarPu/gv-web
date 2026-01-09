<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import '$styles/login.css';

	let { form } = $props();
	let isLoading = $state(false);

	const tempToken = $derived($page.url.searchParams.get('token'));

	$effect(() => {
		if (!tempToken) {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<title>2FA Verification</title>
</svelte:head>

<div class="login-container">
	<form
		method="POST"
		action="/login?/verify2fa"
		use:enhance={() => {
			isLoading = true;
			return async ({ update }) => {
				isLoading = false;
				await update();
			};
		}}
	>
		<h1>Two-Factor Auth</h1>
		<p class="subtitle">Enter your authenticator code</p>

		{#if form?.message}
			<p class="error-message">{form.message}</p>
		{/if}

		<input type="hidden" name="temp_token" value={tempToken} />

		<div class="form-group">
			<input
				type="text"
				name="code"
				placeholder="000000"
				required
				disabled={isLoading}
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="one-time-code"
				maxlength="6"
			/>
		</div>

		<button type="submit" disabled={isLoading}>
			{#if isLoading}
				<i class="fas fa-spinner fa-spin"></i>
				Verifying...
			{:else}
				<i class="fas fa-lock"></i>
				Verify
			{/if}
		</button>

		<a href="/login" class="back-link">
			<i class="fas fa-arrow-left"></i>
			Back to login
		</a>
	</form>
</div>
