<script lang="ts">
	import { createDateNavigation } from '$shared/utils/dateNavigation.svelte';
	import { Datepicker, Popover } from 'flowbite-svelte';

	const navDate = createDateNavigation();
</script>

<div class="date-navigation">
	<button title="Volver a hoy" onclick={navDate.returnToday}>
		<i class="fa-solid fa-rotate-left"></i>
	</button>
	<button title="Un dia atrás" onclick={navDate.subOneDay}>
		<i class="fa-solid fa-arrow-left"></i>
	</button>
	<p id="date-trigger">{navDate.formatted}</p>
	<Popover triggeredBy="#date-trigger" trigger="click">
		<Datepicker bind:value={navDate.current} inline locale="es-ES" />
	</Popover>
	<button title="Un dia adelante" onclick={navDate.addOneDay}>
		<i class="fa-solid fa-arrow-right"></i>
	</button>
</div>
