<script lang="ts">
	import RightSheet from '$lib/shared/components/RightSheet.svelte';
	import Icon from '$lib/shared/components/Icon.svelte';
	import { calendarApi } from '$lib/domains/calendar/api/calendar.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { formatDateFull } from '$lib/shared/utils/datetime';
	import type { SyncStatus } from '$lib/domains/calendar/types/Calendar.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** Reload calendars and events after connecting or disconnecting an account. */
		refresh: () => Promise<void>;
	}

	let { open, onclose, refresh }: Props = $props();

	let status = $state<SyncStatus | null>(null);
	let loading = $state(false);
	let busy = $state<number | null>(null);
	let connecting = $state(false);

	async function load() {
		loading = true;
		try {
			status = await calendarApi.syncStatus();
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to read sync status', 'error');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) void load();
	});

	/**
	 * Connecting leaves the app: Google's consent screen is a full page load and its redirect
	 * comes back to the API, which sends the browser here again with ?connected=.
	 */
	async function connect() {
		connecting = true;
		try {
			window.location.href = await calendarApi.authUrl();
		} catch (e) {
			connecting = false;
			addToast(e instanceof Error ? e.message : 'Failed to start the connection', 'error');
		}
	}

	async function resync(id: number) {
		busy = id;
		try {
			const result = await calendarApi.resyncAccount(id);
			addToast(`Rebuilt: ${result.upserted} events across ${result.calendars} calendars`);
			await Promise.all([load(), refresh()]);
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Resync failed', 'error');
		} finally {
			busy = null;
		}
	}

	async function disconnect(id: number, email: string) {
		busy = id;
		try {
			await calendarApi.deleteAccount(id);
			addToast(`Disconnected ${email}`);
			await Promise.all([load(), refresh()]);
		} catch (e) {
			addToast(e instanceof Error ? e.message : 'Failed to disconnect', 'error');
		} finally {
			busy = null;
		}
	}
</script>

<RightSheet {open} {onclose}>
	<h3 class="modal-title">Google accounts</h3>

	{#if loading && !status}
		<p class="cal-empty-note">Loading…</p>
	{:else if status}
		{#if !status.configured}
			<p class="cal-note">
				<Icon name="circle-exclamation" /> This server has no Google credentials configured, so no account
				can be connected.
			</p>
		{/if}

		<p class="cal-meta">
			Updates arrive {status.webhooks_active
				? 'by push notification, in seconds'
				: `on the poll, every ${status.poll_interval}`}.
			{#if !status.webhooks_active}
				<span class="cal-hint"
					>Push needs the API's domain verified with Google; polling covers it meanwhile.</span
				>
			{/if}
		</p>

		{#each status.accounts as account (account.id)}
			{@const calendars = status.calendars.filter((c) => c.account_email === account.email)}
			<div class="cal-account-card" class:needs-reauth={account.status !== 'connected'}>
				<div class="cal-account-card-head">
					<strong>{account.email}</strong>
					<span
						class="status-badge"
						class:cal-badge-ok={account.status === 'connected'}
						class:cal-badge-warn={account.status !== 'connected'}>{account.status}</span
					>
				</div>
				<p class="cal-meta">
					{account.calendars} calendars · {calendars.reduce((sum, c) => sum + c.events, 0)} events
					{#if account.last_sync_at}
						· synced {formatDateFull(account.last_sync_at)}
					{/if}
				</p>
				{#if account.last_sync_error}
					<p class="cal-error">{account.last_sync_error}</p>
				{/if}
				<div class="cal-account-card-actions">
					<button
						class="cal-btn"
						disabled={busy === account.id}
						onclick={() => resync(account.id)}
						title="Throw the local copy away and rebuild it from Google"
					>
						<Icon name="rotate-left" /> Rebuild
					</button>
					<button
						class="btn-danger"
						disabled={busy === account.id}
						onclick={() => disconnect(account.id, account.email)}
						title="Revoke this app's access at Google and delete the mirrored data"
					>
						<Icon name="trash" /> Disconnect
					</button>
				</div>
			</div>
		{/each}

		<button
			class="btn-primary cal-connect"
			disabled={!status.configured || connecting}
			onclick={connect}
		>
			<Icon name="plus" />
			{connecting ? 'Opening Google…' : 'Connect an account'}
		</button>

		{#if status.recent_runs.length}
			<h4 class="cal-subtitle">Recent syncs</h4>
			<ul class="cal-runs">
				{#each status.recent_runs.slice(0, 8) as run (run.id)}
					<li class:failed={!!run.error}>
						<span class="cal-run-when">{formatDateFull(run.started_at)}</span>
						<span class="cal-run-what">{run.trigger} · {run.kind}</span>
						<span class="cal-run-counts">+{run.upserted} / −{run.deleted}</span>
						{#if run.error}<span class="cal-error">{run.error}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</RightSheet>
