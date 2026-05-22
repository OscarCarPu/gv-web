import { formatTime } from '$lib/shared/utils/datetime';
import type { TimeEntrySummaryResponse } from '$lib/domains/tasks/types/Task.types';

export function buildPaceTooltip(summary: TimeEntrySummaryResponse): string {
	const pace = summary.pace;

	if (pace.goal_reached) return 'Goal reached ✓';

	const remaining = summary.weekly_target_seconds - summary.week;

	if (pace.remaining_full_days === 0) {
		return `${formatTime(remaining)} today`;
	}

	const uniform = `${formatTime(pace.uniform_per_day_seconds)}/day · ${formatTime(pace.uniform_today_share_seconds)} today`;
	const weighted = `${formatTime(pace.weighted_weekday_seconds)} Mon-Fri · ${formatTime(pace.weighted_weekend_seconds)} Sat-Sun · ${formatTime(pace.weighted_today_share_seconds)} today`;
	return `${uniform} | ${weighted}`;
}
