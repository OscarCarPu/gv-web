<script lang="ts">
	import { getNotifications } from '$lib/shared/stores/notification.svelte';

	const notifications = $derived(getNotifications());
</script>

{#if notifications.length > 0}
	<div class="notification-container">
		{#each notifications as notification (notification.id)}
			<div
				class="notification-card"
				class:notification-success={notification.type === 'success'}
				class:notification-error={notification.type === 'error'}
				role="status"
				aria-live="polite"
			>
				<i
					class="notification-icon fa-solid {notification.type === 'success'
						? 'fa-check'
						: 'fa-xmark'}"
				></i>
				<span class="notification-text">{notification.action}</span>
			</div>
		{/each}
	</div>
{/if}
