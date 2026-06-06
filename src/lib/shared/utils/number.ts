/**
 * Clamp `value` into the inclusive `[min, max]` range.
 * A `null` or `NaN` input is treated as `min` (used by the varieties score
 * inputs, where an empty/invalid field collapses to the bottom of the range).
 */
export function clamp(value: number | null, min: number, max: number): number {
	if (value === null || Number.isNaN(value)) return min;
	return Math.max(min, Math.min(max, value));
}
