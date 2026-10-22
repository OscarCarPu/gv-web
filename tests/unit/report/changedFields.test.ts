import { describe, it, expect } from 'vitest';
import { changedFields, MISSING } from '$lib/domains/report/utils/changedFields';
import { opLabel } from '$lib/domains/report/utils/opLabel';

describe('changedFields', () => {
	it('lists only the fields that differ between the sides', () => {
		const diff = changedFields({
			base: { id: 2, name: 'two', note: 'same' },
			home: { id: 2, name: 'home-edit', note: 'same' },
			ec2: { id: 2, name: 'ec2-edit', note: 'same' },
		});

		expect(diff).toEqual([{ field: 'name', base: 'two', home: 'home-edit', ec2: 'ec2-edit' }]);
	});

	it('lists every field on request', () => {
		const diff = changedFields(
			{
				base: { id: 2, name: 'two', note: 'same' },
				home: { id: 2, name: 'home-edit', note: 'same' },
				ec2: { id: 2, name: 'two', note: 'same' },
			},
			true
		);

		expect(diff.map((d) => d.field)).toEqual(['id', 'name', 'note']);
	});

	it('compares only the sides that have a row, and marks the missing one', () => {
		const diff = changedFields({
			base: { id: 3, name: 'three', note: 'same' },
			home: { id: 3, name: 'edited', note: 'same' },
			ec2: null,
		});

		expect(diff).toEqual([{ field: 'name', base: 'three', home: 'edited', ec2: MISSING }]);
	});

	it('shows the whole row when only one side has it', () => {
		const diff = changedFields({ base: null, home: { id: 1, name: 'new' }, ec2: null });

		expect(diff.map((d) => d.field)).toEqual(['id', 'name']);
	});

	it('writes null, numbers and objects as readable text', () => {
		const diff = changedFields({
			base: { a: null, b: 1, c: { x: 1 } },
			home: { a: 'v', b: 2, c: { x: 2 } },
			ec2: { a: null, b: 1, c: { x: 1 } },
		});

		expect(diff).toEqual([
			{ field: 'a', base: 'null', home: 'v', ec2: 'null' },
			{ field: 'b', base: '1', home: '2', ec2: '1' },
			{ field: 'c', base: '{"x":1}', home: '{"x":2}', ec2: '{"x":1}' },
		]);
	});
});

describe('opLabel', () => {
	it('says what home did and what the restored data holds instead', () => {
		expect(opLabel({ op: 'insert', ec2: null })).toBe('Created at home; not in the restored data');
		expect(opLabel({ op: 'insert', ec2: { id: 1 } })).toBe(
			'Created at home; the restored data has a different row with the same id'
		);
		expect(opLabel({ op: 'update', ec2: { id: 1 } })).toBe(
			'Edited at home; the restored data has another version'
		);
		expect(opLabel({ op: 'update', ec2: null })).toBe(
			'Edited at home; deleted in the restored data'
		);
		expect(opLabel({ op: 'delete', ec2: { id: 1 } })).toBe(
			'Deleted at home; still in the restored data'
		);
	});
});
