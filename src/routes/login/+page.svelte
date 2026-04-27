<script lang="ts">
	import { enhance } from '$app/forms';
	import '$styles/login.css';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Iniciar Sesión</title>
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
		<h1>Acceso Privado</h1>

		{#if form?.message}
			<p class="error-message">{form.message}</p>
		{/if}

		<div class="form-group">
			<input
				type="password"
				name="password"
				placeholder="Contraseña"
				required
				disabled={isLoading}
				autocomplete="current-password"
			/>
		</div>

		<button type="submit" disabled={isLoading}>
			{#if isLoading}
				<Icon name="spinner" spin />
				Verificando...
			{:else}
				Siguiente
				<Icon name="arrow-right" />
			{/if}
		</button>
	</form>
</div>
