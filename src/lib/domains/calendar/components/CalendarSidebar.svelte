<script lang="ts">
	import Icon from '$lib/shared/components/Icon.svelte';
	import { CalendarView } from '$lib/domains/calendar/calendarView.svelte';

	interface Props {
		view: CalendarView;
		onmanage: () => void;
	}

	let { view, onmanage }: Props = $props();
</script>

<aside class="cal-sidebar">
	{#each view.calendarsByAccount as group (group.email)}
		<div class="cal-account-group">
			<div class="cal-account-head">
				<span class="cal-account-email" title={group.email}>{group.email}</span>
				{#if group.status !== 'connected'}
					<span class="status-badge cal-badge-warn" title="Reconnect this account to sync again"
						>reconnect</span
					>
				{/if}
			</div>

			{#each group.calendars as calendar (calendar.id)}
				<div class="cal-cal-row" class:disabled={!calendar.sync_enabled}>
					{#if calendar.sync_enabled}
						<label class="cal-cal-toggle">
							<input
								type="checkbox"
								checked={calendar.visible}
								onchange={() => view.toggleCalendarVisible(calendar)}
							/>
							<span
								class="cal-dot"
								style="--chip: {calendar.color || 'var(--color-primary)'}"
								aria-hidden="true"
							></span>
							<span class="cal-cal-name" title={calendar.summary}>{calendar.summary}</span>
						</label>
					{:else}
						<button
							type="button"
							class="cal-cal-enable"
							title="Not synced. Turn it on to mirror it — a big calendar is imported in full."
							onclick={() => view.toggleCalendarSync(calendar)}
						>
							<Icon name="plus" />
							<span class="cal-cal-name">{calendar.summary}</span>
						</button>
					{/if}
					{#if calendar.sync_enabled && !calendar.writable}
						<span class="cal-readonly" title="Read-only in Google">
							<Icon name="lock" />
						</span>
					{/if}
					{#if calendar.deleted}
						<span class="cal-readonly" title="This calendar no longer exists in Google">
							<Icon name="circle-exclamation" />
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/each}

	{#if view.calendars.length === 0}
		<p class="cal-empty-note">
			No Google account connected yet. Open <strong>Accounts</strong> to add one.
		</p>
	{/if}

	<div class="cal-sidebar-actions">
		<button type="button" class="cal-btn" onclick={() => view.syncNow()}>
			<Icon name="rotate-left" /> Sync now
		</button>
		<button type="button" class="cal-btn" onclick={onmanage}>
			<Icon name="folder" /> Accounts
		</button>
	</div>
</aside>
