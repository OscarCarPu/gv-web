import { formatTime } from '$lib/shared/utils/datetime';
import type { TimeEntrySummaryResponse } from '$lib/domains/tasks/types/Task.types';

export function buildPaceTooltip(summary: TimeEntrySummaryResponse): string {
	const pace = summary.pace;

	if (pace.goal_reached) return 'Meta alcanzada ✓';

	const remaining = summary.weekly_target_seconds - summary.week;

	if (pace.remaining_full_days === 0) {
		return `${formatTime(remaining)} hoy`;
	}

	const uniform = `${formatTime(pace.uniform_per_day_seconds)}/día · ${formatTime(pace.uniform_today_share_seconds)} hoy`;
	const weighted = `${formatTime(pace.weighted_weekday_seconds)} L-V · ${formatTime(pace.weighted_weekend_seconds)} S-D · ${formatTime(pace.weighted_today_share_seconds)} hoy`;
	return `${uniform} | ${weighted}`;
}
