import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VarietyCardApi } from '$lib/domains/varieties/components/varietyCard.svelte';
import type { Variety } from '$lib/domains/varieties/types/Variety.types';

function makeVariety(over: Partial<Variety> = {}): Variety {
	return {
		id: 1,
		name: 'Kush',
		scent: 5,
		flavor: 5,
		power: 5,
		quality: 5,
		score: 5,
		price: 10,
		comments: null,
		judge: 'Oscar',
		...over,
	};
}

function createMockApi(): VarietyCardApi & {
	updateVariety: ReturnType<typeof vi.fn>;
	deleteVariety: ReturnType<typeof vi.fn>;
} {
	return {
		updateVariety: vi.fn().mockResolvedValue(makeVariety()),
		deleteVariety: vi.fn().mockResolvedValue(undefined),
	};
}

describe('VarietyCard controller', () => {
	let VarietyCard: typeof import('$lib/domains/varieties/components/varietyCard.svelte').VarietyCard;
	let api: ReturnType<typeof createMockApi>;
	let refreshMock: ReturnType<typeof vi.fn>;
	let refresh: () => Promise<void>;

	beforeEach(async () => {
		vi.useFakeTimers();
		const module = await import('$lib/domains/varieties/components/varietyCard.svelte');
		VarietyCard = module.VarietyCard;
		api = createMockApi();
		refreshMock = vi.fn().mockResolvedValue(undefined);
		refresh = refreshMock as unknown as () => Promise<void>;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('seeds local field mirrors from the passed variety', () => {
		const card = new VarietyCard(makeVariety({ name: 'Diesel', scent: 7, comments: 'note' }), {
			api,
			refresh,
		});

		expect(card.name).toBe('Diesel');
		expect(card.scent).toBe(7);
		expect(card.comments).toBe('note');
		expect(card.judge).toBe('Oscar');
	});

	it('seeds blank comments when the variety has none', () => {
		const card = new VarietyCard(makeVariety({ comments: null }), { api, refresh });
		expect(card.comments).toBe('');
	});

	describe('scheduleSave (debounce)', () => {
		it('coalesces rapid edits into a single save after 400ms', () => {
			const card = new VarietyCard(makeVariety(), { api, refresh });

			card.scheduleSave();
			vi.advanceTimersByTime(100);
			card.scheduleSave();
			vi.advanceTimersByTime(100);
			card.scheduleSave();

			// Not yet fired.
			expect(api.updateVariety).not.toHaveBeenCalled();

			vi.advanceTimersByTime(400);
			expect(api.updateVariety).toHaveBeenCalledTimes(1);
		});

		it('does not save before the debounce window elapses', () => {
			const card = new VarietyCard(makeVariety(), { api, refresh });
			card.scheduleSave();
			vi.advanceTimersByTime(399);
			expect(api.updateVariety).not.toHaveBeenCalled();
		});
	});

	describe('save', () => {
		it('clamps out-of-range scores into [0, 10] and falls back name/judge', async () => {
			const card = new VarietyCard(makeVariety({ name: 'Orig', judge: 'OrigJudge' }), {
				api,
				refresh,
			});
			card.scent = 99;
			card.flavor = -4;
			card.power = 10.5;
			card.quality = 3.3;
			card.price = 12.5;
			card.name = '   ';
			card.judge = '';
			card.comments = '  ';

			await card.save();

			expect(api.updateVariety).toHaveBeenCalledWith(1, {
				name: 'Orig',
				scent: 10,
				flavor: 0,
				power: 10,
				quality: 3.3,
				price: 12.5,
				comments: null,
				judge: 'OrigJudge',
			});
			expect(refreshMock).toHaveBeenCalled();
		});

		it('treats null/NaN scores as 0 and null price as 0', async () => {
			const card = new VarietyCard(makeVariety(), { api, refresh });
			card.scent = null;
			card.flavor = NaN;
			card.power = null;
			card.quality = null;
			card.price = null;

			await card.save();

			const payload = api.updateVariety.mock.calls[0][1];
			expect(payload.scent).toBe(0);
			expect(payload.flavor).toBe(0);
			expect(payload.power).toBe(0);
			expect(payload.quality).toBe(0);
			expect(payload.price).toBe(0);
		});

		it('does not refresh when the API rejects', async () => {
			api.updateVariety.mockRejectedValueOnce(new Error('boom'));
			const card = new VarietyCard(makeVariety(), { api, refresh });

			await card.save();

			expect(refreshMock).not.toHaveBeenCalled();
			expect(card.saving).toBe(false);
		});
	});

	describe('commitCommentsEdit', () => {
		it('cancels the pending debounce timer then saves once when comments changed', async () => {
			const card = new VarietyCard(makeVariety({ comments: 'old' }), { api, refresh });
			card.comments = 'new';

			// Pending autosave is in flight.
			card.scheduleSave();
			await card.commitCommentsEdit();

			// commit's own save ran...
			expect(api.updateVariety).toHaveBeenCalledTimes(1);
			expect(card.editingComments).toBe(false);

			// ...and the pending timer was cancelled, so advancing does not fire a second save.
			vi.advanceTimersByTime(400);
			expect(api.updateVariety).toHaveBeenCalledTimes(1);
		});

		it('does not save when comments are unchanged', async () => {
			const card = new VarietyCard(makeVariety({ comments: 'same' }), { api, refresh });
			card.comments = 'same';

			await card.commitCommentsEdit();

			expect(api.updateVariety).not.toHaveBeenCalled();
			expect(card.editingComments).toBe(false);
		});
	});

	describe('remove', () => {
		it('calls deleteVariety and refreshes', async () => {
			const card = new VarietyCard(makeVariety({ id: 9 }), { api, refresh });

			await card.remove();

			expect(api.deleteVariety).toHaveBeenCalledWith(9);
			expect(refreshMock).toHaveBeenCalled();
		});

		it('does not refresh when delete rejects', async () => {
			api.deleteVariety.mockRejectedValueOnce(new Error('boom'));
			const card = new VarietyCard(makeVariety({ id: 9 }), { api, refresh });

			await card.remove();

			expect(refreshMock).not.toHaveBeenCalled();
		});
	});
});
