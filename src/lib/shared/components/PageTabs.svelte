<script lang="ts" generics="T extends string">
	/**
	 * Centered subtab selector shared by page-level tabs. Each tab is either a link
	 * (`href`, for route-backed tabs like /money) or a button that reports its `value`
	 * through `onselect` (for in-page state like /tasks' Today / Projects).
	 */
	interface Tab {
		value: T;
		label: string;
		href?: string;
	}

	interface Props {
		tabs: Tab[];
		active: T;
		onselect?: (value: T) => void;
	}

	let { tabs, active, onselect }: Props = $props();
</script>

<nav class="page-tabs">
	{#each tabs as tab (tab.value)}
		{#if tab.href}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved hrefs -->
			<a href={tab.href} class="page-tab" class:active={active === tab.value}>{tab.label}</a>
		{:else}
			<button
				class="page-tab"
				class:active={active === tab.value}
				onclick={() => onselect?.(tab.value)}
			>
				{tab.label}
			</button>
		{/if}
	{/each}
</nav>
