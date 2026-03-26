<script lang="ts">
	import { Datepicker, Popover, type DateOrRange } from 'flowbite-svelte';

	let { value = $bindable(''), id = '' }: { value: string; id?: string } = $props();

	let triggerId = $derived(id ? `dtp-${id}` : `dtp-${Math.random().toString(36).slice(2, 8)}`);

	let dateObj = $derived.by(() => {
		if (!value) return null;
		const d = new Date(value);
		return isNaN(d.getTime()) ? null : d;
	});

	let displayDate = $derived(
		dateObj
			? dateObj.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
			: 'Sin fecha'
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
		if (isNaN(val)) { hours = ''; return; }
		hours = Math.max(0, Math.min(23, val)).toString();
		applyTime();
	}

	function onMinutesInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) { minutes = ''; return; }
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

<div class="datetime-pill">
	<button type="button" class="pill-date" id={triggerId}>
		{displayDate}
	</button>
	<span class="pill-divider"></span>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="pill-time" onclick={(e) => e.stopPropagation()}>
		<input
			type="number" min="0" max="23" step="1"
			placeholder="HH" value={hours}
			oninput={onHoursInput}
		/>
		<span class="colon">:</span>
		<input
			type="number" min="0" max="59" step="1"
			placeholder="MM" value={minutes}
			oninput={onMinutesInput}
		/>
	</div>
	{#if value}
		<button type="button" class="pill-clear" onclick={clear} title="Quitar fecha">
			<i class="fa-solid fa-xmark"></i>
		</button>
	{/if}
	<Popover triggeredBy="#{triggerId}" trigger="click">
		<Datepicker
			value={dateObj ?? undefined}
			onselect={handleDateSelect}
			inline
			locale="es-ES"
		/>
	</Popover>
</div>

<style>
	@reference "../../../styles/app.css";

	.datetime-pill {
		@apply flex items-center bg-bg border border-text-muted/20 rounded-lg overflow-hidden;

		&:focus-within {
			@apply border-text-muted/40;
		}
	}

	.pill-date {
		@apply bg-transparent border-none text-text text-sm px-3 py-2 cursor-pointer text-left flex-1;

		&:hover {
			@apply bg-text-muted/5;
		}
	}

	.pill-divider {
		@apply w-px self-stretch bg-text-muted/20;
	}

	.pill-time {
		@apply flex items-center gap-1 px-2.5 py-2;

		input {
			@apply text-center bg-transparent border-none focus:outline-none
			       text-sm font-mono text-text p-0;
			width: 2.5ch;
			-moz-appearance: textfield;
			appearance: textfield;

			&::-webkit-outer-spin-button,
			&::-webkit-inner-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}

			&::placeholder {
				@apply text-text-muted/30;
			}
		}

		.colon {
			@apply text-text-muted font-mono text-sm;
		}
	}

	.pill-clear {
		@apply bg-transparent border-none text-text-muted cursor-pointer pr-2.5 pl-0 py-2
		       hover:text-danger transition-colors text-xs;
	}
</style>
