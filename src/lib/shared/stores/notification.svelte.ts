let nextId = 0;

interface Notification {
	id: number;
	action: string;
	type: 'success' | 'error';
}

let notifications = $state<Notification[]>([]);

export function addNotification(action: string, type: 'success' | 'error' = 'success') {
	const id = nextId++;
	notifications.push({ id, action, type });
	setTimeout(() => {
		notifications = notifications.filter((n) => n.id !== id);
	}, 2000);
}

export function getNotifications(): Notification[] {
	return notifications;
}
