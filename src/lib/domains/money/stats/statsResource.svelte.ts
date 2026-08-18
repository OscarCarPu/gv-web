/**
 * Generic anti-flicker fetch holder shared by every money stats sheet.
 *
 * Each sheet keeps a single open-`$effect` that calls `load(currentParams)` in the
 * if-branch and `resetForClose()` in the else-branch. The spinner is driven by
 * `initialLoading` (NOT `loading`): it is `true` only before the very first fetch,
 * so subsequent refetches keep the previous chart rendered until the new data
 * arrives. On error the data is reset to the seeded `empty` value.
 */
interface StatsResourceOptions<TParams, TData> {
	fetcher: (params: TParams) => Promise<TData>;
	empty: TData;
}

export class StatsResource<TParams, TData> {
	data = $state<TData>() as TData;
	initialLoading = $state(true);

	#fetcher: (params: TParams) => Promise<TData>;
	#empty: TData;

	constructor({ fetcher, empty }: StatsResourceOptions<TParams, TData>) {
		this.#fetcher = fetcher;
		this.#empty = empty;
		this.data = empty;
	}

	/** Fetch with `params`; resets to `empty` on error and always clears `initialLoading`. */
	async load(params: TParams): Promise<void> {
		try {
			this.data = await this.#fetcher(params);
		} catch {
			this.data = this.#empty;
		} finally {
			this.initialLoading = false;
		}
	}

	/** Clean slate for the next open: empty data and re-arm the first-fetch spinner. */
	resetForClose(): void {
		this.data = this.#empty;
		this.initialLoading = true;
	}
}
