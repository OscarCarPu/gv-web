import { describe, it, expect } from 'vitest';
import type { ReportItem } from '$lib/domains/report/api/report.schemas';
import {
	groupItems,
	relatedTitles,
	rowTitle,
	tableLabel,
} from '$lib/domains/report/utils/rowTitle';

function item(table: string, key: string, rows: Partial<ReportItem> = {}): ReportItem {
	return { table, key, op: 'update', base: null, home: null, ec2: null, related: {}, ...rows };
}

describe('rowTitle', () => {
	it('names a task by its name, from the version before the edits', () => {
		const c = item('tasks', '[7]', {
			base: { id: 7, name: 'Design homepage' },
			home: { id: 7, name: 'Design homepage v2' },
			ec2: { id: 7, name: 'Design homepage v3' },
		});
		expect(rowTitle(c)).toBe('Design homepage');
	});

	it('uses what home created, not the unrelated row the restored data has under that key', () => {
		const c = item('tasks', '[9]', { home: { name: 'Home only' }, ec2: { name: 'Someone else' } });
		expect(rowTitle(c)).toBe('Home only');
	});

	it('describes a time entry by its span and comment', () => {
		const c = item('time_entries', '[3]', {
			base: {
				started_at: '2026-10-11T13:00:00.123+00:00',
				finished_at: '2026-10-11T14:30:00+00:00',
				comment: 'Wireframes',
			},
		});
		expect(rowTitle(c)).toBe('2026-10-11 13:00 – 2026-10-11 14:30 · Wireframes');
	});

	it('says a time entry is still running', () => {
		const c = item('time_entries', '[3]', {
			base: { started_at: '2026-10-11T13:00:00+00:00', finished_at: null, comment: null },
		});
		expect(rowTitle(c)).toBe('2026-10-11 13:00 – running');
	});

	it('describes a transaction by its description and amount', () => {
		expect(
			rowTitle(item('transactions', '[5]', { base: { description: 'Groceries', amount: '33.20' } }))
		).toBe('Groceries · 33.20');
		expect(
			rowTitle(item('transactions', '[5]', { base: { description: null, amount: '8.00' } }))
		).toBe('No description · 8.00');
	});

	it('uses the first field that says something, and the key when nothing does', () => {
		expect(rowTitle(item('plan_blocks', '[1]', { base: { label: 'Deep work', note: 'x' } }))).toBe(
			'Deep work'
		);
		expect(rowTitle(item('lights', '["abc"]', { base: { id: 'abc', name: '' } }))).toBe('["abc"]');
		expect(rowTitle(item('tasks', '[2]'))).toBe('[2]');
	});
});

describe('relatedTitles', () => {
	it('names the rows an item points at', () => {
		const c = item('time_entries', '[3]', {
			related: { task_id: { table: 'tasks', row: { id: 7, name: 'Design homepage' } } },
		});
		expect(relatedTitles(c)).toEqual(['Task: Design homepage']);
	});

	it('is empty when nothing is pointed at', () => {
		expect(relatedTitles(item('tasks', '[1]'))).toEqual([]);
	});
});

describe('tableLabel', () => {
	it('uses friendly names and falls back to the table name', () => {
		expect(tableLabel('time_entries')).toBe('Time entry');
		expect(tableLabel('some_new_table')).toBe('some new table');
	});
});

describe('groupItems', () => {
	it('puts each kind together, kinds and rows in a stable order', () => {
		const groups = groupItems([
			item('transactions', '[1]', { base: { description: 'B', amount: '1' } }),
			item('tasks', '[2]', { base: { name: 'Zeta' } }),
			item('tasks', '[1]', { base: { name: 'Alpha' } }),
			item('accounts', '[1]', { base: { name: 'Bank' } }),
		]);

		expect(groups.map((g) => g.label)).toEqual(['Account', 'Task', 'Transaction']);
		expect(groups[1].items.map((c) => c.key)).toEqual(['[1]', '[2]']);
	});

	it('is empty when there is nothing to show', () => {
		expect(groupItems([])).toEqual([]);
	});
});
