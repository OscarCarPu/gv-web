import type { LocalMark } from '../types/Rutas.types';

const STORAGE_KEY = 'rutas_marks';

export function loadMarks(): Map<string, LocalMark> {
	if (typeof localStorage === 'undefined') return new Map();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Map();
		const arr: LocalMark[] = JSON.parse(raw);
		return new Map(arr.map((m) => [m.name, m]));
	} catch {
		return new Map();
	}
}

export function saveMarks(marks: Map<string, LocalMark>): void {
	if (typeof localStorage === 'undefined') return;
	const arr = Array.from(marks.values());
	localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
