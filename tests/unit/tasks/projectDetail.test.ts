import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProjectDetailApi } from '$lib/domains/tasks/projectDetail.svelte';
import type { ProjectDetailResponse } from '$lib/domains/tasks/types/Task.types';

function makeProject(over: Partial<ProjectDetailResponse> = {}): ProjectDetailResponse {
	return {
		id: 1,
		parent_id: null,
		name: 'Project',
		description: null,
		due_at: null,
		started_at: null,
		finished_at: null,
		time_spent: 0,
		...over,
	};
}

function createMockApi(): ProjectDetailApi & {
	updateProject: ReturnType<typeof vi.fn>;
	deleteProject: ReturnType<typeof vi.fn>;
} {
	return {
		updateProject: vi.fn().mockResolvedValue({}),
		deleteProject: vi.fn().mockResolvedValue(undefined),
	};
}

describe('ProjectDetail', () => {
	let ProjectDetail: typeof import('$lib/domains/tasks/projectDetail.svelte').ProjectDetail;
	let api: ReturnType<typeof createMockApi>;
	let refresh: ReturnType<typeof vi.fn> & (() => Promise<void>);

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
		const module = await import('$lib/domains/tasks/projectDetail.svelte');
		ProjectDetail = module.ProjectDetail;
		api = createMockApi();
		refresh = vi.fn().mockResolvedValue(undefined) as unknown as ReturnType<typeof vi.fn> &
			(() => Promise<void>);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetModules();
	});

	it('load hydrates name/description/dueAt from the project', () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ name: 'P', description: 'desc' }));

		expect(detail.name).toBe('P');
		expect(detail.description).toBe('desc');
	});

	it('save sends the update and refreshes; clears saving in finally', async () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7, name: 'P' }));

		await detail.save();

		expect(api.updateProject).toHaveBeenCalledWith(
			7,
			expect.objectContaining({ name: 'P', description: null })
		);
		expect(refresh).toHaveBeenCalled();
		expect(detail.saving).toBe(false);
	});

	it('save still clears saving when the API rejects', async () => {
		api.updateProject.mockRejectedValueOnce(new Error('boom'));
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7 }));

		await detail.save();

		expect(detail.saving).toBe(false);
		expect(refresh).not.toHaveBeenCalled();
	});

	it('setStarted sends started_at = now and refreshes', async () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7 }));

		await detail.setStarted();

		expect(api.updateProject).toHaveBeenCalledWith(7, {
			started_at: '2026-03-10T10:00:00.000Z',
		});
		expect(refresh).toHaveBeenCalled();
	});

	it('clearStarted sends started_at = null', async () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7, started_at: 'x' }));

		await detail.clearStarted();

		expect(api.updateProject).toHaveBeenCalledWith(7, { started_at: null });
	});

	it('setFinished sends finished_at = now', async () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7 }));

		await detail.setFinished();

		expect(api.updateProject).toHaveBeenCalledWith(7, {
			finished_at: '2026-03-10T10:00:00.000Z',
		});
	});

	it('remove deletes then refreshes', async () => {
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7 }));

		await detail.remove();

		expect(api.deleteProject).toHaveBeenCalledWith(7);
		expect(refresh).toHaveBeenCalled();
	});

	it('remove refreshes even when delete rejects', async () => {
		api.deleteProject.mockRejectedValueOnce(new Error('boom'));
		const detail = new ProjectDetail(refresh, api);
		detail.load(makeProject({ id: 7 }));

		await detail.remove();

		expect(refresh).toHaveBeenCalled();
	});

	it('no-ops when no project is loaded', async () => {
		const detail = new ProjectDetail(refresh, api);

		await detail.save();
		await detail.setStarted();
		await detail.remove();

		expect(api.updateProject).not.toHaveBeenCalled();
		expect(api.deleteProject).not.toHaveBeenCalled();
	});
});
