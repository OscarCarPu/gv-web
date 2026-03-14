<script lang="ts">
	let { icon = 'fa-solid fa-note-sticky', text }: { icon?: string; text: string } = $props();
</script>

<div class="floating-reminder">
	<i class={icon}></i>
	{text}
</div>
