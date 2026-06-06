import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HabitCardApi } from '$lib/domains/habits/components/habitCard.svelte';
import type { HabitWithLog } from '$lib/domains/habits/types/Habit.types';

function makeHabit(over: Partial<HabitWithLog> = {}): HabitWithLog {
	return {
		id: 1,
		name: 'Habit',
		description: null,
		log_value: null,
		frequency: 'daily',
		target_min: null,
		target_max: null,
		recording_required: true,
		period_value: 0,
		current_streak: 0,
		longest_streak: 0,
		...over,
	};
}

function createMockApi(): HabitCardApi & { logHabit: ReturnType<typeof vi.fn> } {
	return {
		logHabit: vi.fn().mockResolvedValue({ status: 'ok' }),
	};
}

describe('HabitCard', () => {
	let HabitCard: typeof import('$lib/domains/habits/components/habitCard.svelte').HabitCard;
	let api: ReturnType<typeof createMockApi>;
	let onRefresh: ReturnType<typeof vi.fn> & (() => void);

	beforeEach(async () => {
		const module = await import('$lib/domains/habits/components/habitCard.svelte');
		HabitCard = module.HabitCard;
		api = createMockApi();
		onRefresh = vi.fn() as unknown as ReturnType<typeof vi.fn> & (() => void);
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe('log', () => {
		it('optimistically sets the value, logs, and calls onRefresh', async () => {
			const habit = makeHabit({ id: 3 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.log(5);

			expect(api.logHabit).toHaveBeenCalledWith({ habit_id: 3, date: '2026-03-16', value: 5 });
			expect(card.optimisticValue).toBe(5);
			expect(onRefresh).toHaveBeenCalled();
		});

		it('rolls back the optimistic value when the API rejects', async () => {
			api.logHabit.mockRejectedValueOnce(new Error('boom'));
			const habit = makeHabit({ id: 3 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.log(5);

			expect(card.optimisticValue).toBeNull();
			expect(onRefresh).not.toHaveBeenCalled();
		});

		it('clamps negative values to 0', async () => {
			const habit = makeHabit({ id: 3 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.log(-4);

			expect(api.logHabit).toHaveBeenCalledWith({ habit_id: 3, date: '2026-03-16', value: 0 });
			expect(card.optimisticValue).toBe(0);
		});
	});

	describe('increment / decrement', () => {
		it('increment logs displayValue + 1', async () => {
			const habit = makeHabit({ log_value: 2 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.increment();

			expect(api.logHabit).toHaveBeenCalledWith(expect.objectContaining({ value: 3 }));
		});

		it('decrement clamps at 0 when at 0', async () => {
			const habit = makeHabit({ log_value: 0 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.decrement();

			expect(api.logHabit).toHaveBeenCalledWith(expect.objectContaining({ value: 0 }));
			expect(card.optimisticValue).toBe(0);
		});

		it('decrement from 1 logs 0', async () => {
			const habit = makeHabit({ log_value: 1 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.decrement();

			expect(api.logHabit).toHaveBeenCalledWith(expect.objectContaining({ value: 0 }));
		});
	});

	describe('reconcile', () => {
		it('clears the optimistic value once the live habit reflects it', async () => {
			const habit = makeHabit({ log_value: null });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);

			await card.log(7);
			expect(card.optimisticValue).toBe(7);

			// Server reload now reports the logged value.
			habit.log_value = 7;
			card.reconcile();

			expect(card.optimisticValue).toBeNull();
		});
	});

	describe('progressPct', () => {
		it('range: position within [min, max]', () => {
			const habit = makeHabit({ target_min: 2, target_max: 10, period_value: 6 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			// (6 - 2) / (10 - 2) * 100 = 50
			expect(card.progressPct).toBe(50);
		});

		it('range with min === max returns 100 when met, 0 otherwise', () => {
			const metHabit = makeHabit({ target_min: 5, target_max: 5, period_value: 5 });
			const metCard = new HabitCard(
				() => metHabit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(metCard.progressPct).toBe(100);

			const unmetHabit = makeHabit({ target_min: 5, target_max: 5, period_value: 2 });
			const unmetCard = new HabitCard(
				() => unmetHabit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(unmetCard.progressPct).toBe(0);
		});

		it('min-only: capped at 100', () => {
			const habit = makeHabit({ target_min: 4, target_max: null, period_value: 2 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			// 2 / 4 * 100 = 50
			expect(card.progressPct).toBe(50);

			const overHabit = makeHabit({ target_min: 4, target_max: null, period_value: 8 });
			const overCard = new HabitCard(
				() => overHabit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(overCard.progressPct).toBe(100);
		});

		it('max-only: capped at 100', () => {
			const habit = makeHabit({ target_min: null, target_max: 10, period_value: 5 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			// 5 / 10 * 100 = 50
			expect(card.progressPct).toBe(50);
		});

		it('returns 0 when there is no target', () => {
			const habit = makeHabit({ target_min: null, target_max: null, period_value: 5 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(card.progressPct).toBe(0);
		});
	});

	describe('targetMet / exceeded', () => {
		it('range: met when within bounds, exceeded above max', () => {
			const habit = makeHabit({ target_min: 2, target_max: 10, period_value: 6 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(card.targetMet).toBe(true);
			expect(card.exceeded).toBe(false);
		});

		it('min-only: met at or above min, never exceeded', () => {
			const habit = makeHabit({ target_min: 4, target_max: null, period_value: 4 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(card.targetMet).toBe(true);
			expect(card.exceeded).toBe(false);
		});

		it('max-only: met at or below max, exceeded above', () => {
			const habit = makeHabit({ target_min: null, target_max: 10, period_value: 12 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(card.targetMet).toBe(false);
			expect(card.exceeded).toBe(true);
		});

		it('no target: never met, never exceeded', () => {
			const habit = makeHabit({ target_min: null, target_max: null, period_value: 5 });
			const card = new HabitCard(
				() => habit,
				() => '2026-03-16',
				{ onRefresh, api }
			);
			expect(card.targetMet).toBe(false);
			expect(card.exceeded).toBe(false);
		});
	});
});
