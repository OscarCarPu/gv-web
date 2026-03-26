<script lang="ts">
	let { value = '', onchange }: { value: string; onchange: (value: string) => void } = $props();

	let hours = $state('');
	let minutes = $state('');

	$effect(() => {
		if (value) {
			const [h, m] = value.split(':');
			hours = h ?? '';
			minutes = m ?? '';
		} else {
			hours = '';
			minutes = '';
		}
	});

	function emit() {
		if (hours === '' && minutes === '') {
			onchange('');
			return;
		}
		const h = (hours === '' ? '0' : hours).padStart(2, '0');
		const m = (minutes === '' ? '0' : minutes).padStart(2, '0');
		onchange(`${h}:${m}`);
	}

	function onHoursInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) {
			hours = '';
		} else {
			if (val < 0) val = 0;
			if (val > 23) val = 23;
			hours = val.toString();
		}
		emit();
	}

	function onMinutesInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let val = parseInt(input.value);
		if (isNaN(val)) {
			minutes = '';
		} else {
			if (val < 0) val = 0;
			if (val > 59) val = 59;
			minutes = val.toString();
		}
		emit();
	}
</script>

<div class="pill-container">
	<div class="pill-time">
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
</div>
