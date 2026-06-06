import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RutasMarksApi } from '$lib/domains/rutas/rutasMarks.svelte';
import type { ConcelhoFeature, RutasMark } from '$lib/domains/rutas/types/Rutas.types';

function makeApiMark(over: Partial<RutasMark> = {}): RutasMark {
	return {
		id: 1,
		name: 'Vigo',
		visited_on: '2024-01-15T00:00:00Z',
		description: 'note',
		...over,
	};
}

function makeFeature(name: string, province = 'Pontevedra'): ConcelhoFeature {
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [0, 0] },
		properties: { id: name, name, province, prov_code: '36' },
	};
}

function createMockApi(): RutasMarksApi & {
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
} {
	return {
		create: vi.fn().mockResolvedValue(makeApiMark()),
		update: vi.fn().mockResolvedValue(makeApiMark()),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}

describe('RutasMarks', () => {
	let RutasMarks: typeof import('$lib/domains/rutas/rutasMarks.svelte').RutasMarks;
	let api: ReturnType<typeof createMockApi>;

	beforeEach(async () => {
		vi.useFakeTimers();
		const module = await import('$lib/domains/rutas/rutasMarks.svelte');
		RutasMarks = module.RutasMarks;
		api = createMockApi();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	describe('constructor', () => {
		it('seeds the map from initial API marks, keyed by name with date sliced', () => {
			const marks = new RutasMarks(
				[makeApiMark({ id: 3, name: 'Lugo', visited_on: '2023-05-02T00:00:00Z' })],
				api
			);

			expect(marks.has('Lugo')).toBe(true);
			expect(marks.get('Lugo')).toEqual({
				apiId: 3,
				name: 'Lugo',
				date: '2023-05-02',
				description: 'note',
			});
		});
	});

	describe('save — create', () => {
		it('creates a new mark and optimistically writes it into the map', async () => {
			api.create.mockResolvedValueOnce(
				makeApiMark({
					id: 10,
					name: 'Ourense',
					visited_on: '2025-03-01T00:00:00Z',
					description: 'd',
				})
			);
			const marks = new RutasMarks([], api);

			await marks.save('Ourense', { visited_on: '2025-03-01', description: 'd' });

			expect(api.create).toHaveBeenCalledWith({
				name: 'Ourense',
				visited_on: '2025-03-01',
				description: 'd',
			});
			expect(api.update).not.toHaveBeenCalled();
			expect(marks.get('Ourense')).toEqual({
				apiId: 10,
				name: 'Ourense',
				date: '2025-03-01',
				description: 'd',
			});
			expect(marks.saving).toBe(false);
		});
	});

	describe('save — update', () => {
		it('updates an existing mark via update() (not create) and rewrites the map', async () => {
			api.update.mockResolvedValueOnce(
				makeApiMark({ id: 5, name: 'Vigo', visited_on: '2026-02-02T00:00:00Z', description: 'new' })
			);
			const marks = new RutasMarks([makeApiMark({ id: 5, name: 'Vigo' })], api);

			await marks.save('Vigo', { visited_on: '2026-02-02', description: 'new' });

			expect(api.update).toHaveBeenCalledWith(5, { visited_on: '2026-02-02', description: 'new' });
			expect(api.create).not.toHaveBeenCalled();
			expect(marks.get('Vigo')).toEqual({
				apiId: 5,
				name: 'Vigo',
				date: '2026-02-02',
				description: 'new',
			});
		});
	});

	describe('save — rollback', () => {
		it('leaves the map unchanged and resets saving when the API rejects on create', async () => {
			api.create.mockRejectedValueOnce(new Error('boom'));
			const marks = new RutasMarks([], api);

			await marks.save('Ferrol', { visited_on: '2025-01-01', description: '' });

			expect(marks.has('Ferrol')).toBe(false);
			expect(marks.saving).toBe(false);
			expect(marks.modalOpen).toBe(false);
		});

		it('leaves the existing mark untouched when update rejects', async () => {
			api.update.mockRejectedValueOnce(new Error('boom'));
			const marks = new RutasMarks(
				[
					makeApiMark({
						id: 5,
						name: 'Vigo',
						visited_on: '2024-01-15T00:00:00Z',
						description: 'orig',
					}),
				],
				api
			);

			await marks.save('Vigo', { visited_on: '2026-09-09', description: 'changed' });

			expect(marks.get('Vigo')).toEqual({
				apiId: 5,
				name: 'Vigo',
				date: '2024-01-15',
				description: 'orig',
			});
			expect(marks.saving).toBe(false);
		});
	});

	describe('remove', () => {
		it('optimistically deletes the mark from the map and calls api.delete', async () => {
			const marks = new RutasMarks([makeApiMark({ id: 5, name: 'Vigo' })], api);

			await marks.remove('Vigo');

			expect(api.delete).toHaveBeenCalledWith(5);
			expect(marks.has('Vigo')).toBe(false);
			expect(marks.saving).toBe(false);
		});

		it('keeps the mark in the map when the API rejects', async () => {
			api.delete.mockRejectedValueOnce(new Error('boom'));
			const marks = new RutasMarks([makeApiMark({ id: 5, name: 'Vigo' })], api);

			await marks.remove('Vigo');

			expect(marks.has('Vigo')).toBe(true);
			expect(marks.saving).toBe(false);
		});

		it('is a no-op (closes modal) when there is no mark for the name', async () => {
			const marks = new RutasMarks([], api);
			marks.openModal(makeFeature('Nowhere'));

			await marks.remove('Nowhere');

			expect(api.delete).not.toHaveBeenCalled();
			expect(marks.modalOpen).toBe(false);
		});
	});

	describe('modal', () => {
		it('openModal sets the feature + open flag; closeModal clears them', () => {
			const marks = new RutasMarks([], api);
			const feature = makeFeature('Vigo');

			marks.openModal(feature);
			expect(marks.modalOpen).toBe(true);
			expect(marks.selectedFeature).toEqual(feature);

			marks.closeModal();
			expect(marks.modalOpen).toBe(false);
			expect(marks.selectedFeature).toBeNull();
		});
	});

	describe('province filter', () => {
		it('setProvince and clearProvince update activeProvince', () => {
			const marks = new RutasMarks([], api);

			expect(marks.activeProvince).toBeNull();
			marks.setProvince('Lugo');
			expect(marks.activeProvince).toBe('Lugo');
			marks.clearProvince();
			expect(marks.activeProvince).toBeNull();
		});
	});
});
