<script lang="ts">
	import type { ReportItem } from '$lib/domains/report/api/report.schemas';
	import { changedFields } from '$lib/domains/report/utils/changedFields';
	import { opLabel } from '$lib/domains/report/utils/opLabel';
	import { relatedTitles, rowTitle, tableLabel } from '$lib/domains/report/utils/rowTitle';

	let { item }: { item: ReportItem } = $props();

	let showAll = $state(false);
	const fields = $derived(changedFields(item, showAll));
	const related = $derived(relatedTitles(item));
</script>

<article class="report-card">
	<header class="report-card-header">
		<span class="report-kind">{tableLabel(item.table)}</span>
		<h3>{rowTitle(item)}</h3>
		{#each related as line (line)}
			<p class="report-related">{line}</p>
		{/each}
		<p>{opLabel(item)}</p>
	</header>

	<table class="report-fields">
		<thead>
			<tr>
				<th>Field</th>
				<th>Before</th>
				<th>Home</th>
				<th>Restored</th>
			</tr>
		</thead>
		<tbody>
			{#each fields as f (f.field)}
				<tr>
					<th scope="row">{f.field}</th>
					<td>{f.base}</td>
					<td>{f.home}</td>
					<td>{f.ec2}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<button type="button" class="report-toggle" onclick={() => (showAll = !showAll)}>
		{showAll ? 'Show changed fields only' : 'Show all fields'}
	</button>
</article>
