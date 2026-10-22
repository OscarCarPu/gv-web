import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReportApi } from '$lib/domains/report/reportScreen.svelte';
import type { ReportItem, ReportStatus } from '$lib/domains/report/api/report.schemas';

const toast = vi.fn();
vi.mock('$shared/stores/toast.svelte', () => ({ addToast: toast }));

const item: ReportItem = {
	table: 'parents',
	key: '[2]',
	op: 'update',
	base: { id: 2, name: 'two' },
	home: { id: 2, name: 'home' },
	ec2: { id: 2, name: 'ec2' },
	related: {},
};

function status(over: Partial<ReportStatus> = {}): ReportStatus {
	return { mode: 'normal', merge: 'done', report: { items: [item], skipped: [] }, ...over };
}

function mockApi(next: ReportStatus = status()) {
	return {
		status: vi.fn().mockResolvedValue(next),
		dismiss: vi.fn().mockResolvedValue(undefined),
	} satisfies ReportApi;
}

describe('ReportScreen', () => {
	let ReportScreen: typeof import('$lib/domains/report/reportScreen.svelte').ReportScreen;

	beforeEach(async () => {
		vi.useFakeTimers();
		toast.mockClear();
		({ ReportScreen } = await import('$lib/domains/report/reportScreen.svelte'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('view', () => {
		const cases: [Partial<ReportStatus>, string][] = [
			[{}, 'report'],
			[{ report: { items: [], skipped: [], error: 'no table' } }, 'report'],
			[{ report: { items: [], skipped: [] } }, 'none'],
			[{ report: null }, 'none'],
			[{ mode: 'merge', merge: 'running' }, 'running'],
			[{ mode: 'merge', merge: 'failed', error: 'disk full' }, 'failed'],
			[{ mode: 'hold', merge: '' }, 'waiting'],
		];
		it.each(cases)('%j shows %s', (over, view) => {
			expect(new ReportScreen(status(over), mockApi()).view).toBe(view);
		});

		it('shows nothing to review without a status, so a page opened for nothing leaves', () => {
			expect(new ReportScreen(null, mockApi()).view).toBe('none');
		});
	});

	describe('dismiss', () => {
		it('dismisses, then asks for the new status', async () => {
			const api = mockApi(status({ report: null }));
			const screen = new ReportScreen(status(), api);

			expect(await screen.dismiss()).toBe(true);

			expect(api.dismiss).toHaveBeenCalledOnce();
			expect(screen.view).toBe('none');
			expect(screen.busy).toBe(false);
		});

		it('does not dismiss twice at once', async () => {
			const api = mockApi();
			let release: () => void = () => {};
			api.dismiss.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
			const screen = new ReportScreen(status(), api);

			const first = screen.dismiss();
			expect(await screen.dismiss()).toBe(false);
			release();
			await first;

			expect(api.dismiss).toHaveBeenCalledOnce();
		});

		it('reports a refusal and keeps the report', async () => {
			const api = mockApi();
			api.dismiss.mockRejectedValue(new Error('boom'));
			const screen = new ReportScreen(status(), api);

			expect(await screen.dismiss()).toBe(false);

			expect(toast).toHaveBeenCalledWith('boom', 'error');
			expect(screen.view).toBe('report');
			expect(screen.busy).toBe(false);
		});
	});

	describe('polling', () => {
		it('refreshes on every tick while the app is held', async () => {
			const held = status({ mode: 'merge', merge: 'running', report: null });
			const api = mockApi(held);
			const screen = new ReportScreen(held, api);
			screen.start(1000);

			await vi.advanceTimersByTimeAsync(2000);
			expect(api.status).toHaveBeenCalledTimes(2);

			api.status.mockResolvedValue(status());
			await vi.advanceTimersByTimeAsync(1000);
			expect(screen.view).toBe('report');

			await vi.advanceTimersByTimeAsync(3000);
			expect(api.status).toHaveBeenCalledTimes(3);
			screen.stop();
		});

		it('keeps the last status when the API is unreachable', async () => {
			const api = mockApi();
			api.status.mockRejectedValue(new Error('connection reset'));
			const screen = new ReportScreen(status(), api);

			await screen.refresh();

			expect(screen.view).toBe('report');
			expect(toast).not.toHaveBeenCalled();
		});

		it('stops when asked', async () => {
			const api = mockApi();
			const screen = new ReportScreen(status({ mode: 'hold', merge: '' }), api);
			screen.start(1000);
			screen.stop();

			await vi.advanceTimersByTimeAsync(5000);

			expect(api.status).not.toHaveBeenCalled();
		});
	});
});
