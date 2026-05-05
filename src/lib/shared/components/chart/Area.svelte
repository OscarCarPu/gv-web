<script lang="ts">
	import { getContext } from 'svelte';

	const { data, xGet, yGet, height } = getContext('LayerCake') as Record<string, any>;

	$: areaPath =
		'M' +
		$data.map((d: any) => `${$xGet(d)},${$yGet(d)}`).join('L') +
		`L${$xGet($data[$data.length - 1])},${$height}` +
		`L${$xGet($data[0])},${$height}Z`;
</script>

<path d={areaPath} fill="var(--color-primary)" opacity="0.1" />
