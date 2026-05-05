const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
	let f = formatterCache.get(currency);
	if (!f) {
		f = new Intl.NumberFormat('es-ES', {
			style: 'currency',
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
			useGrouping: 'always',
		});
		formatterCache.set(currency, f);
	}
	return f;
}

export function formatMoney(amount: string | number, currency: string = 'EUR'): string {
	const n = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (!Number.isFinite(n)) return amount?.toString() ?? '';
	try {
		return getFormatter(currency).format(n);
	} catch {
		return getFormatter('EUR').format(n);
	}
}
