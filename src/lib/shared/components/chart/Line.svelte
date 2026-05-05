<script lang="ts">
	import { getContext } from 'svelte';

	const { data, xGet, yGet } = getContext('LayerCake') as Record<string, any>;

	$: path = 'M' + $data.map((d: any) => `${$xGet(d)},${$yGet(d)}`).join('L');
</script>

<path
	class="line-path"
	d={path}
	fill="none"
	stroke="var(--color-primary)"
	stroke-width="2"
	stroke-linejoin="round"
	stroke-linecap="round"
/>
