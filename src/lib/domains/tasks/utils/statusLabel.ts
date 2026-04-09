export function getStatusLabel(
	started_at: string | null | undefined,
	task_type?: string,
	recurrence?: number | null
): string {
	if (!started_at) return 'Pendiente';
	switch (task_type) {
		case 'continuous':
			return 'Continua';
		case 'recurring':
			return `Recurrente · Cada ${recurrence ?? '?'} días`;
		default:
			return 'En progreso';
	}
}
