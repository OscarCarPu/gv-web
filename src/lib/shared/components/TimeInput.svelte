<script lang="ts">
	interface Props {
		value: string;
		allowMidnight?: boolean;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
		'aria-label'?: string;
	}

	let {
		value = $bindable(),
		allowMidnight = false,
		placeholder = 'HH:MM',
		disabled = false,
		id,
		'aria-label': ariaLabel,
	}: Props = $props();

	const pattern = $derived(
		allowMidnight ? '([01]\\d|2[0-3]):[0-5]\\d|24:00' : '([01]\\d|2[0-3]):[0-5]\\d'
	);
</script>

<input
	type="text"
	inputmode="numeric"
	maxlength="5"
	{placeholder}
	{disabled}
	{id}
	aria-label={ariaLabel}
	{pattern}
	bind:value
/>
