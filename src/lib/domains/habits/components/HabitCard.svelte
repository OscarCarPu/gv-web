<script>
	let { habit } = $props();
</script>

<div class="habit-card">
	<h2 class="habit-title">{habit.name}</h2>
	<span class="habit-value">{habit.date_value ?? '-'}</span>
</div>
