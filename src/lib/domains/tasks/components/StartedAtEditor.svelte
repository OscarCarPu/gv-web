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
	<div class="started-at-pill" onfocusout={handleFocusOut}>
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

<style>
	@reference "../../../../styles/app.css";

	.started-at-pill {
		@apply flex items-center bg-bg border border-text-muted/20 rounded-lg overflow-hidden m-1;

		.pill-label {
			@apply text-sm text-text-muted font-medium px-3 py-2;
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
	}
</style>
