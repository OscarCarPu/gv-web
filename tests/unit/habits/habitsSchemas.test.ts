import { describe, it, expect } from 'vitest';
import { HabitWithLogListSchema, CreateHabitResponseSchema, LogUpsertResponseSchema } from '$lib/domains/habits/api/habits.schemas';

describe('habits schemas', () => {
	it('HabitWithLogListSchema parses list', () => {
		const result = HabitWithLogListSchema.parse([
			{ id: 1, name: 'Read', description: null, log_value: 1 }
		]);
		expect(result).toHaveLength(1);
	});

	it('HabitWithLogListSchema transforms null to empty array', () => {
		const result = HabitWithLogListSchema.parse(null);
		expect(result).toEqual([]);
	});

	it('CreateHabitResponseSchema parses response', () => {
		const result = CreateHabitResponseSchema.parse({ id: 1, name: 'Read', description: null });
		expect(result.id).toBe(1);
	});

	it('LogUpsertResponseSchema parses response', () => {
		const result = LogUpsertResponseSchema.parse({ status: 'ok' });
		expect(result.status).toBe('ok');
	});
});
