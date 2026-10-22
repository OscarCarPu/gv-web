import { reportApi } from '$lib/domains/report/api/report.api';
import { hasContent } from '$lib/domains/report/utils/hasContent';
import type { ReportStatus } from '$lib/domains/report/api/report.schemas';

const UNLOCKED_FOR_MS = 5000;

export interface FailoverStatus {
	/** The API is held after a failover. */
	locked: boolean;
	/** A report of what home had is waiting to be read. */
	report: boolean;
}

const open: FailoverStatus = { locked: false, report: false };

/**
 * What the layout needs to know after a failover. An unlocked answer is remembered for a few
 * seconds, so the usual case costs one call per interval instead of one per page; a locked answer
 * is never remembered, so the app opens the moment the hold ends. A missing or unreachable answer
 * counts as unlocked, and is remembered the same way.
 */
export function createFailoverStatus(
	fetchStatus: (token: string) => Promise<ReportStatus>,
	now: () => number = Date.now
) {
	let until = 0;
	let last = open;

	return async (token: string): Promise<FailoverStatus> => {
		if (now() < until) return last;

		let status = open;
		try {
			const s = await fetchStatus(token);
			status = { locked: s.mode !== 'normal', report: hasContent(s.report) };
		} catch {
			status = open;
		}
		if (!status.locked) {
			last = status;
			until = now() + UNLOCKED_FOR_MS;
		}
		return status;
	};
}

export const failoverStatus = createFailoverStatus((token) => reportApi.status(token));
