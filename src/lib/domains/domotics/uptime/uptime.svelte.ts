import { uptimeApi } from './api/uptime.api';
import type {
	Device,
	DeviceWindows,
	Overview,
	UptimeWindow,
	WindowsReport,
} from './api/uptime.schemas';

/**
 * Controller for the Uptime tab.
 *
 * Unlike the other domotics tabs there is nothing to poll: the numbers come from marts that
 * only change when dbt runs, and dbt is a batch job. So the tab loads once, says how old the
 * data is, and refreshes when asked. Auto-polling would be a request every few seconds for a
 * value that moves a couple of times a day.
 *
 * The timeline is built from the windows the API returns, using its clipped `seconds` rather
 * than recomputing the overlap here — that keeps the bar and the percentage telling the same
 * story.
 */

export const RANGE_PRESETS = [
	{ key: '24h', label: '24 h', ms: 24 * 60 * 60 * 1000 },
	{ key: '7d', label: '7 d', ms: 7 * 24 * 60 * 60 * 1000 },
	{ key: '30d', label: '30 d', ms: 30 * 24 * 60 * 60 * 1000 },
	{ key: '90d', label: '90 d', ms: 90 * 24 * 60 * 60 * 1000 },
] as const;

export type PresetKey = (typeof RANGE_PRESETS)[number]['key'];

/** One drawn piece of the timeline, positioned as a percentage of the range. */
export type Segment = {
	state: 'up' | 'down' | 'unknown';
	left: number;
	width: number;
	label: string;
};

/** How many outages the card lists before it stops; the count is shown either way. */
const OUTAGES_SHOWN = 5;

export class UptimeController {
	overview = $state<Overview | null>(null);
	report = $state<WindowsReport | null>(null);
	preset = $state<PresetKey>('30d');
	loading = $state(false);
	/** Set when a read fails, including the 503 that means no pipeline database is wired up. */
	error = $state<string | null>(null);

	constructor(overview: Overview | null, report: WindowsReport | null, preset: PresetKey = '30d') {
		this.overview = overview;
		this.report = report;
		this.preset = preset;
	}

	get stale(): boolean {
		return this.overview?.stale ?? true;
	}

	/** Both reads together: the overview and the window list for the selected range. */
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

	/** Switching range only needs the windows, but a refresh is cheap and keeps them in step. */
	async selectPreset(preset: PresetKey) {
		if (preset === this.preset && !this.error) return;
		await this.refresh(preset);
	}

	windowsFor(device: Device): DeviceWindows | undefined {
		return this.report?.devices.find((d) => d.device === device);
	}

	/**
	 * Timeline pieces for one device, oldest first so the bar reads left to right. A range
	 * the device has no windows for renders as a single unknown segment rather than as
	 * silence.
	 */
	segmentsFor(device: Device): Segment[] {
		const report = this.report;
		const entry = this.windowsFor(device);
		if (!report) return [];

		const from = new Date(report.from).getTime();
		const to = new Date(report.to).getTime();
		const span = to - from;
		if (span <= 0) return [];

		if (!entry || entry.windows.length === 0) {
			return [{ state: 'unknown', left: 0, width: 100, label: 'no data' }];
		}

		return entry.windows
			.map((w) => {
				const start = Math.max(new Date(w.start_time).getTime(), from);
				return {
					state: w.state,
					left: ((start - from) / span) * 100,
					width: Math.min(100, ((w.seconds * 1000) / span) * 100),
					label: w.state,
				};
			})
			.sort((a, b) => a.left - b.left);
	}

	/** Down windows, newest first, capped — the "what actually went wrong" list. */
	outagesFor(device: Device): UptimeWindow[] {
		const entry = this.windowsFor(device);
		if (!entry) return [];
		return entry.windows.filter((w) => w.state === 'down').slice(0, OUTAGES_SHOWN);
	}
}

/** The from/to an API call for a preset uses. `to` is left to the API, which clamps to now. */
export function rangeFor(preset: PresetKey): { from: string } {
	const ms = RANGE_PRESETS.find((p) => p.key === preset)?.ms ?? 30 * 24 * 60 * 60 * 1000;
	return { from: new Date(Date.now() - ms).toISOString() };
}
