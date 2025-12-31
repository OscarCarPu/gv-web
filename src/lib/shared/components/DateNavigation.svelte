<script lang="ts">
	import { createDateNavigation } from '$shared/utils/dateNavigation.svelte';
	import { Datepicker, Popover, type DateOrRange } from 'flowbite-svelte';

	let { onDateChange }: { onDateChange?: (date: Date) => void } = $props();
	const navDate = createDateNavigation();

	function handleReturnToday() {
		navDate.returnToday();
		onDateChange?.(navDate.current);
	}

	function handleSubOneDay() {
		navDate.subOneDay();
		onDateChange?.(navDate.current);
	}

	function handleAddOneDay() {
		navDate.addOneDay();
		onDateChange?.(navDate.current);
	}

	function handleDatepickerSelect(selectedDate: DateOrRange) {
		if (selectedDate instanceof Date) {
			navDate.current = selectedDate;
			onDateChange?.(navDate.current);
		}
	}
</script>

<div class="date-navigation">
	<button title="Volver a hoy" onclick={handleReturnToday}>
		<i class="fa-solid fa-rotate-left"></i>
	</button>
	<button title="Un dia atrás" onclick={handleSubOneDay}>
		<i class="fa-solid fa-arrow-left"></i>
	</button>
	<p id="date-trigger">{navDate.formatted}</p>
	<Popover triggeredBy="#date-trigger" trigger="click">
		<Datepicker value={navDate.current} onselect={handleDatepickerSelect} inline locale="es-ES" />
	</Popover>
	<button title="Un dia adelante" onclick={handleAddOneDay}>
		<i class="fa-solid fa-arrow-right"></i>
	</button>
</div>
