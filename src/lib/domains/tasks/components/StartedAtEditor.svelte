<script lang="ts">
	import { Popover } from 'flowbite-svelte';

	let {
		startedAt,
		onchange,
	}: {
		startedAt: Date;
		onchange: (newDate: Date) => void;
	} = $props();

	let hours = $state('');
	let minutes = $state('');

	$effect(() => {
		hours = startedAt.getHours().toString().padStart(2, '0');
		minutes = startedAt.getMinutes().toString().padStart(2, '0');
	});

	function apply() {
		const newDate = new Date(startedAt);
		newDate.setHours(parseInt(hours) || 0);
		newDate.setMinutes(parseInt(minutes) || 0);
		newDate.setSeconds(0);
		if (newDate.getTime() > Date.now()) return;
		onchange(newDate);
	}

	function onHoursInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) { hours = ''; return; }
		hours = Math.max(0, Math.min(23, val)).toString();
	}

	function onMinutesInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) { minutes = ''; return; }
		minutes = Math.max(0, Math.min(59, val)).toString();
	}

	function handleFocusOut(e: FocusEvent) {
		const editor = (e.currentTarget as HTMLElement);
		const newTarget = e.relatedTarget as Node | null;
		if (!newTarget || !editor.contains(newTarget)) {
			apply();
		}
	}
</script>

<Popover triggeredBy="#timer-display-trigger" trigger="click" class="started-at-popover">
	<div class="pill-container m-1" onfocusout={handleFocusOut}>
		<span class="pill-label">Inicio</span>
		<span class="pill-divider"></span>
		<div class="pill-time">
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
	</div>
</Popover>
