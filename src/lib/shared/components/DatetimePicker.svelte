<script lang="ts">
	import { Datepicker, Popover, type DateOrRange } from 'flowbite-svelte';
	import Icon from '$lib/shared/components/Icon.svelte';

	let { value = $bindable(''), id = '' }: { value: string; id?: string } = $props();

	let triggerId = $derived(id ? `dtp-${id}` : `dtp-${Math.random().toString(36).slice(2, 8)}`);
	let popoverOpen = $state(false);

	let dateObj = $derived.by(() => {
		if (!value) return null;
		const d = new Date(value);
		return isNaN(d.getTime()) ? null : d;
	});

	let displayDate = $derived(
		dateObj
			? dateObj.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
			: 'No date'
	);

	let hours = $state('');
	let minutes = $state('');

	$effect(() => {
		if (dateObj) {
			hours = dateObj.getHours().toString().padStart(2, '0');
			minutes = dateObj.getMinutes().toString().padStart(2, '0');
		} else {
			hours = '';
			minutes = '';
		}
	});

	function handleDateSelect(selected: DateOrRange) {
		if (!(selected instanceof Date)) return;
		const h = parseInt(hours) || 0;
		const m = parseInt(minutes) || 0;
		selected.setHours(h, m, 0, 0);
		emitValue(selected);
	}

	function onHoursInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) {
			hours = '';
			return;
		}
		hours = Math.max(0, Math.min(23, val)).toString();
		applyTime();
	}

	function onMinutesInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) {
			minutes = '';
			return;
		}
		minutes = Math.max(0, Math.min(59, val)).toString();
		applyTime();
	}

	function applyTime() {
		if (!dateObj) return;
		const d = new Date(dateObj);
		d.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
		emitValue(d);
	}

	function emitValue(d: Date) {
		const pad = (n: number) => n.toString().padStart(2, '0');
		value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function clear() {
		value = '';
	}
</script>

<div class="pill-container">
	<button type="button" class="pill-date" id={triggerId}>
		{displayDate}
	</button>
	<span class="pill-divider"></span>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="pill-time" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
		<input
			type="number"
			min="0"
			max="23"
			step="1"
			placeholder="HH"
			value={hours}
			oninput={onHoursInput}
		/>
		<span class="colon">:</span>
		<input
			type="number"
			min="0"
			max="59"
			step="1"
			placeholder="MM"
			value={minutes}
			oninput={onMinutesInput}
		/>
	</div>
	{#if value}
		<button type="button" class="pill-clear" onclick={clear} title="Clear date">
			<Icon name="xmark" />
		</button>
	{/if}
	<Popover triggeredBy="#{triggerId}" trigger="click" bind:isOpen={popoverOpen}>
		<Datepicker
			value={dateObj ?? undefined}
			onselect={handleDateSelect}
			inline
			locale="en-US"
			firstDayOfWeek={1}
		/>
	</Popover>
</div>
