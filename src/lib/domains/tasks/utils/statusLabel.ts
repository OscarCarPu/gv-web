export function getStatusLabel(
	started_at: string | null | undefined,
	task_type?: string,
	recurrence?: number | null
): string {
	if (!started_at) return 'Pending';
	switch (task_type) {
		case 'continuous':
			return 'Continuous';
		case 'recurring':
			return `Recurring · Every ${recurrence ?? '?'} days`;
		default:
			return 'In progress';
	}
}
