export function toLocalDateString(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function toLocalDatetime(iso: string | null): string {
	if (!iso) return '';
	return iso.slice(0, 16);
}

export function toISOString(local: string): string | null {
	if (!local) return null;
	const d = new Date(local);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

export function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDateShort(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export function formatDateFull(iso: string): string {
	return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
