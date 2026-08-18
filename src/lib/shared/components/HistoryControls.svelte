<script lang="ts">
	import Icon, { type IconName } from '$lib/shared/components/Icon.svelte';

	interface Frequency {
		value: string;
		icon: IconName;
	}

	interface Props {
		frequencies: readonly Frequency[];
		frequency: string;
		startAt: string;
		endAt: string;
		onfrequencychange: (value: string) => void;
		ondatechange: () => void;
	}

	let {
		frequencies,
		frequency,
		startAt = $bindable(),
		endAt = $bindable(),
		onfrequencychange,
		ondatechange,
	}: Props = $props();
</script>

<div class="history-controls">
	<div class="frequency-toggle">
		{#each frequencies as f (f)}
			<button
				class:active={frequency === f.value}
				onclick={() => onfrequencychange(f.value)}
				type="button"
				aria-label={f.value}
			>
				<Icon name={f.icon} />
			</button>
		{/each}
	</div>
	<div class="history-dates">
		<input type="date" bind:value={startAt} onchange={ondatechange} />
		<span class="date-separator">&mdash;</span>
		<input type="date" bind:value={endAt} onchange={ondatechange} />
	</div>
</div>
