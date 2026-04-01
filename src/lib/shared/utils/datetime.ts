export function toLocalDatetime(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toISOString(local: string): string | null {
	if (!local) return null;
	return local.split('T')[0];
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
