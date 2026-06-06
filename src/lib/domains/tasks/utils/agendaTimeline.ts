import type { TimeEntryWithTask } from '$lib/domains/tasks/types/Task.types';

export type AgendaItem =
	| { type: 'entry'; entry: TimeEntryWithTask; hourLabel: string | null }
	| { type: 'gap'; duration: number; from: string; to: string }
	| { type: 'day'; label: string };

function formatDay(d: Date): string {
	const weekday = d.toLocaleDateString('en', { weekday: 'long' });
	const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
	return `${capitalized} ${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Build the Agenda timeline from raw time entries: sort ascending by `started_at`, insert
 * day dividers at midnight, split gaps longer than 120s across day boundaries, and emit a
 * per-hour label whenever the hour changes. The result is reversed for most-recent-first
 * display. Pure: entries in → items out.
 */
export function buildAgendaItems(entries: TimeEntryWithTask[]): AgendaItem[] {
	// Sort ascending by started_at (full timestamp, not just hour)
	const sorted = [...entries].sort(
		(a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
	);

	const items: AgendaItem[] = [];
	let lastHourKey = '';

	for (let i = 0; i < sorted.length; i++) {
		const d = new Date(sorted[i].started_at);
		const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
		const thisStart = new Date(sorted[i].started_at).getTime();

		if (i > 0) {
			const prevEntry = sorted[i - 1];
			const prevD = new Date(prevEntry.started_at);
			const prevDateKey = `${prevD.getFullYear()}-${prevD.getMonth()}-${prevD.getDate()}`;
			const finishedAt = prevEntry.finished_at;
			const prevEnd = finishedAt ? new Date(finishedAt).getTime() : Date.now();

			if (dateKey !== prevDateKey) {
				// Day boundary — split gap at midnight
				const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

				const gapBefore = (midnight - prevEnd) / 1000;
				if (gapBefore > 120) {
					items.push({
						type: 'gap',
						duration: gapBefore,
						from: new Date(prevEnd).toISOString(),
						to: new Date(midnight).toISOString(),
					});
				}

				items.push({ type: 'day', label: formatDay(d) });

				const gapAfter = (thisStart - midnight) / 1000;
				if (gapAfter > 120) {
					items.push({
						type: 'gap',
						duration: gapAfter,
						from: new Date(midnight).toISOString(),
						to: new Date(thisStart).toISOString(),
					});
				}
			} else {
				// Same day — normal gap
				const gap = (thisStart - prevEnd) / 1000;
				if (gap > 120) {
					items.push({
						type: 'gap',
						duration: gap,
						from: new Date(prevEnd).toISOString(),
						to: new Date(thisStart).toISOString(),
					});
				}
			}
		}

		// Compute hour label — show when the hour changes
		const hourKey = `${dateKey}-${d.getHours()}`;
		const hourLabel =
			hourKey !== lastHourKey ? `${String(d.getHours()).padStart(2, '0')}:00` : null;
		lastHourKey = hourKey;

		items.push({ type: 'entry', entry: sorted[i], hourLabel });
	}

	// Reverse for most-recent-first display
	return items.reverse();
}
