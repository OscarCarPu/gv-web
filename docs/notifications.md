# Action Notification System

Fast, minimal card notifications for create/update/delete operations that auto-dismiss after 2 seconds.

## Usage

Import and call the notification function after successful operations:

```ts
import { addNotification } from '$lib/shared/stores/notification.svelte';

// After creating a task
await tasksApi.createTask(data);
addNotification('Tarea creada', 'success');

// After updating a task
await tasksApi.updateTask(id, data);
addNotification('Tarea actualizada', 'success');

// After deleting a task
await tasksApi.deleteTask(id);
addNotification('Tarea eliminada', 'success');

// Error state
addNotification('Error al guardar', 'error');
```

## Design Details

- **Location**: Top right corner (z-index 40)
- **Duration**: 2 seconds auto-dismiss
- **Animation**: Slide-in from right (300ms) + fade-out (400ms starting at 1.6s)
- **States**: Success (green checkmark) / Error (red X)
- **Styling**: Minimal card with subtle border and backdrop blur
- **Icon**: FontAwesome solid icons (`fa-check` for success, `fa-xmark` for error)

## Implementation Pattern

Replace toast messages with notifications for action feedback:

```ts
// Old (3-second toast)
addToast('Tarea creada', 'success');

// New (2-second notification card)
addNotification('Tarea creada', 'success');
```

Keep using `addToast` for form errors and important messages that need user attention.
