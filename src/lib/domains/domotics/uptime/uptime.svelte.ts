import { uptimeApi } from './api/uptime.api';
import type { Kind, Overview, UptimeWindow, WindowsReport } from './api/uptime.schemas';

export const RANGE_PRESETS = [
	{ key: '24h', label: '24 h', ms: 24 * 60 * 60 * 1000 },
	{ key: '7d', label: '7 d', ms: 7 * 24 * 60 * 60 * 1000 },
	{ key: '30d', label: '30 d', ms: 30 * 24 * 60 * 60 * 1000 },
	{ key: '90d', label: '90 d', ms: 90 * 24 * 60 * 60 * 1000 },
] as const;

export type PresetKey = (typeof RANGE_PRESETS)[number]['key'];

export type Segment = {
	kind: Kind | 'unknown';
	left: number;
	width: number;
	label: string;
};

const OUTAGES_SHOWN = 5;

export class UptimeController {
	overview = $state<Overview | null>(null);
	report = $state<WindowsReport | null>(null);
	preset = $state<PresetKey>('30d');
	loading = $state(false);
	error = $state<string | null>(null);

	constructor(overview: Overview | null, report: WindowsReport | null, preset: PresetKey = '30d') {
		this.overview = overview;
		this.report = report;
		this.preset = preset;
	}

	async refresh(preset: PresetKey = this.preset) {
		this.loading = true;
		try {
			const [overview, report] = await Promise.all([
				uptimeApi.overview(),
				uptimeApi.windows(rangeFor(preset)),
			]);
			this.overview = overview;
			this.report = report;
			this.preset = preset;
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'failed to read uptime';
		} finally {
			this.loading = false;
		}
	}

	async selectPreset(preset: PresetKey) {
		if (preset === this.preset && !this.error) return;
		await this.refresh(preset);
	}

	get segments(): Segment[] {
		const report = this.report;
		if (!report) return [];

		const from = new Date(report.from).getTime();
		const span = new Date(report.to).getTime() - from;
		if (span <= 0) return [];

		if (report.windows.length === 0) {
			return [{ kind: 'unknown', left: 0, width: 100, label: 'no data' }];
		}

		return report.windows
			.map((w) => {
				const start = Math.max(new Date(w.start_time).getTime(), from);
				return {
					kind: w.kind,
					left: ((start - from) / span) * 100,
					width: Math.min(100, ((w.seconds * 1000) / span) * 100),
					label: w.kind,
				};
			})
			.sort((a, b) => a.left - b.left);
	}

	get outages(): UptimeWindow[] {
		return (this.report?.windows ?? []).filter((w) => w.kind === 'down').slice(0, OUTAGES_SHOWN);
	}
}

export function rangeFor(preset: PresetKey): { from: string } {
	const ms = RANGE_PRESETS.find((p) => p.key === preset)?.ms ?? 30 * 24 * 60 * 60 * 1000;
	return { from: new Date(Date.now() - ms).toISOString() };
}
