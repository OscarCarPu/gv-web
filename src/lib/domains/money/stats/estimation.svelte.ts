import { moneyApi } from '$lib/domains/money/api/money.api';
import { monthKey } from '../utils/statsDate';
import type { EstimationMode, EstimationPoint, EstimationResult } from '../types/Money.types';

export interface EstimationApi {
	getEstimation: (params: {
		start_month: string;
		end_month: string;
		mode: EstimationMode;
	}) => Promise<EstimationResult>;
}

function defaultStart(): string {
	const d = new Date();
	return monthKey(new Date(d.getFullYear(), d.getMonth() - 5, 1));
}

function defaultEnd(): string {
	const d = new Date();
	return monthKey(new Date(d.getFullYear() + 1, d.getMonth(), 1));
}

/**
 * Owns EstimationSheet state: the mode toggle, the start/end month inputs, the
 * range-validity guard, the anti-flicker fetch, and the `{ points, rate, saving }`
 * result decoding (the server returns an object, not a bare array — CLAUDE.md).
 *
 * Estimation does not use the shared `StatsResource` because its result is `null`
 * until the first fetch (not a seeded empty array) and it layers an `errorMsg`
 * short-circuit on top of the load. The decoding (lastActual backward-scan, delta,
 * rateNum/savingNum) is exposed via `get` accessors, reactive in templates.
 */
export class Estimation {
	startMonth = $state<string>(defaultStart());
	endMonth = $state<string>(defaultEnd());
	mode = $state<EstimationMode>('rate');
	result = $state<EstimationResult | null>(null);
	initialLoading = $state(true);
	errorMsg = $state<string | null>(null);

	#api: EstimationApi;

	constructor(api: EstimationApi = moneyApi) {
		this.#api = api;
	}

	get rangeValid(): boolean {
		if (!this.startMonth || !this.endMonth) return false;
		return this.endMonth >= this.startMonth;
	}

	// ── result decoding (CLAUDE.md: server returns { points, rate, saving }) ──

	get data(): EstimationPoint[] {
		return this.result?.points ?? [];
	}

	get rateNum(): number {
		return this.result ? parseFloat(this.result.rate) : 0;
	}

	get savingNum(): number {
		return this.result ? parseFloat(this.result.saving) : 0;
	}

	/** Last non-estimated point's total (backward scan), or 0. */
	get lastActual(): number {
		const data = this.data;
		for (let i = data.length - 1; i >= 0; i--) {
			if (!data[i].estimated) return parseFloat(data[i].total);
		}
		return 0;
	}

	get lastEstimated(): number {
		const data = this.data;
		return data.length > 0 ? parseFloat(data[data.length - 1].total) : 0;
	}

	get delta(): number {
		return this.lastEstimated - this.lastActual;
	}

	get deltaPct(): number {
		return this.lastActual !== 0 ? (this.delta / this.lastActual) * 100 : 0;
	}

	// ── interactions ────────────────────────────────────────────────────

	setMode(value: EstimationMode): void {
		this.mode = value;
	}

	/** Fetch the estimation; short-circuits with `errorMsg` when the range is invalid. */
	async load(): Promise<void> {
		if (!this.rangeValid) {
			this.errorMsg = 'End month must be the same as or after start month';
			this.result = null;
			this.initialLoading = false;
			return;
		}
		this.errorMsg = null;
		try {
			this.result = await this.#api.getEstimation({
				start_month: this.startMonth,
				end_month: this.endMonth,
				mode: this.mode,
			});
		} catch {
			this.result = null;
		} finally {
			this.initialLoading = false;
		}
	}

	resetForClose(): void {
		this.result = null;
		this.initialLoading = true;
	}
}
