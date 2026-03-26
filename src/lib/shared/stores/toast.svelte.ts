let nextId = 0;

interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error';
}

let toasts = $state<Toast[]>([]);

export function addToast(message: string, type: 'success' | 'error' = 'success') {
	const id = nextId++;
	toasts.push({ id, message, type });
	setTimeout(() => {
		toasts = toasts.filter((t) => t.id !== id);
	}, 3000);
}

export function getToasts(): Toast[] {
	return toasts;
}
