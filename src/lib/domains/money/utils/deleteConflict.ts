/**
 * Shared 409-conflict handling for the money delete flows. Both the Accounts card
 * (`DELETE /finance/accounts/:id` → "...transactions...") and the Categories card
 * (`DELETE /finance/categories/:id` → "...referenced...") run a delete and then
 * sniff the thrown error's message for a known needle to decide whether to show the
 * specific "in use" toast (conflict) or the generic error toast.
 *
 * Returns `{ ok: true, conflict: false }` on success, `{ ok: false, conflict: true }`
 * when the error message includes one of `needles` (the caller shows the specific
 * toast), and `{ ok: false, conflict: false }` for any other error (the caller shows
 * the generic toast). Pure — never throws; never touches reactive state or `invalidateAll`.
 */
export async function deleteWithConflict({
	run,
	needles,
}: {
	run: () => Promise<void>;
	needles: string[];
}): Promise<{ ok: boolean; conflict: boolean }> {
	try {
		await run();
		return { ok: true, conflict: false };
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		const conflict = needles.some((n) => msg.includes(n));
		return { ok: false, conflict };
	}
}
