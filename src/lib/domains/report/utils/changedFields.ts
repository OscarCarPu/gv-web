import type { ReportItem } from '../api/report.schemas';

export interface FieldDiff {
	field: string;
	base: string;
	home: string;
	ec2: string;
}

export const MISSING = '—';

type Row = Record<string, unknown> | null;

function show(row: Row, field: string): string {
	if (!row) return MISSING;
	const value = row[field];
	if (value === null || value === undefined) return 'null';
	return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * The fields that differ between the sides that have a row, or all of them when only one does or
 * `all` is set.
 */
export function changedFields(
	c: Pick<ReportItem, 'base' | 'home' | 'ec2'>,
	all = false
): FieldDiff[] {
	const present = [c.base, c.home, c.ec2].filter((r): r is NonNullable<Row> => r !== null);
	const fields = new Set(present.flatMap((r) => Object.keys(r)));

	return [...fields]
		.filter(
			(field) => all || present.length < 2 || new Set(present.map((r) => show(r, field))).size > 1
		)
		.map((field) => ({
			field,
			base: show(c.base, field),
			home: show(c.home, field),
			ec2: show(c.ec2, field),
		}));
}
