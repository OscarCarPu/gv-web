import type { ReportItem } from '../api/report.schemas';

const LABELS: Record<string, string> = {
	tasks: 'Task',
	projects: 'Project',
	todos: 'To-do',
	time_entries: 'Time entry',
	task_dependencies: 'Task dependency',
	accounts: 'Account',
	categories: 'Category',
	transactions: 'Transaction',
	budgets: 'Budget',
	habits: 'Habit',
	habit_logs: 'Habit log',
	calendar_events: 'Event',
	plan_blocks: 'Plan block',
	recurring_commitments: 'Commitment',
	recurring_commitment_skips: 'Skipped commitment',
	concello_marks: 'Route mark',
	lights: 'Light',
};

type Item = Pick<ReportItem, 'table' | 'key' | 'base' | 'home' | 'ec2'>;
type Row = Record<string, unknown>;

const NAME_FIELDS = ['name', 'label', 'title', 'description', 'comment'];

export function tableLabel(table: string): string {
	return LABELS[table] ?? table.replaceAll('_', ' ');
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const moment = (v: unknown): string => text(v).slice(0, 16).replace('T', ' ');
const day = (v: unknown): string => text(v).slice(0, 10);

function describe(table: string, r: Row): string {
	switch (table) {
		case 'time_entries': {
			const span = `${moment(r.started_at)} – ${r.finished_at ? moment(r.finished_at) : 'running'}`;
			return [span, text(r.comment)].filter(Boolean).join(' · ');
		}
		case 'transactions':
			return [text(r.description) || 'No description', text(r.amount)].filter(Boolean).join(' · ');
		case 'budgets':
			return [day(r.month), text(r.amount)].filter(Boolean).join(' · ');
		case 'habit_logs':
			return day(r.log_date);
	}
	return NAME_FIELDS.map((f) => text(r[f])).find(Boolean) ?? '';
}

/** What the row is about, in the user's words: the name, the description or the time span. */
export function rowTitle(c: Item): string {
	const row = c.base ?? c.home ?? c.ec2;
	return (row && describe(c.table, row)) || c.key;
}

/** The rows the item points at, as "Task: Design homepage". */
export function relatedTitles(c: Pick<ReportItem, 'related'>): string[] {
	return Object.values(c.related).flatMap((r) => {
		const title = describe(r.table, r.row);
		return title ? [`${tableLabel(r.table)}: ${title}`] : [];
	});
}

export interface ReportGroup {
	table: string;
	label: string;
	items: ReportItem[];
}

/** Items of the same kind together, kinds and rows in a stable order. */
export function groupItems(items: ReportItem[]): ReportGroup[] {
	const byTable = new Map<string, ReportItem[]>();
	for (const c of items) byTable.set(c.table, [...(byTable.get(c.table) ?? []), c]);

	return [...byTable.entries()]
		.map(([table, list]) => ({
			table,
			label: tableLabel(table),
			items: list.sort((a, b) => rowTitle(a).localeCompare(rowTitle(b))),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}
