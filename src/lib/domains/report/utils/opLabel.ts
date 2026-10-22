import type { ReportItem } from '../api/report.schemas';

/** What home did, and what the restored data holds instead. */
export function opLabel(c: Pick<ReportItem, 'op' | 'ec2'>): string {
	const there = c.ec2 !== null;
	switch (c.op) {
		case 'insert':
			return there
				? 'Created at home; the restored data has a different row with the same id'
				: 'Created at home; not in the restored data';
		case 'update':
			return there
				? 'Edited at home; the restored data has another version'
				: 'Edited at home; deleted in the restored data';
		default:
			return 'Deleted at home; still in the restored data';
	}
}
