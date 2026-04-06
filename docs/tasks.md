# Tasks

## Overview

Task and project management with time tracking. Hierarchical project/task structure, live timer, time entry logging, and CRUD for projects, tasks, and todos.

## Data Model

### Hierarchy

```
Project (hierarchical via parent_id)
└── Task (belongs to a project via project_id, nullable)
    ├── Todo (subtask, boolean completion)
    ├── TimeEntry (started_at, finished_at, comment)
    └── Dependencies (task_dependencies: task_id → depends_on)
```

### Task Dependencies

Tasks can depend on other tasks via a many-to-many `task_dependencies` table. All task responses include:

- `depends_on: TaskDepRef[]` — tasks this task depends on
- `task_depends: TaskDepRef[]` — tasks that depend on this task

Where `TaskDepRef` is `{ id: number; name: string; due_at: string | null }`.

API accepts `depends_on: number[]` (array of task IDs) on create and update — replaces all existing deps. Omitting the field leaves deps unchanged; passing `[]` clears them.

**Blocked indicator**: Tasks with `blocked: true` display a `fa-ban` icon (`.blocked-icon`) inline next to the task name in TaskItem, TreeNodeItem, and the project detail page. All action buttons (Empezar/Acabar, Asignar/Iniciar) are disabled on blocked tasks.

**Reverse dependency editing**: Editing `blocks` ("Bloquea a") in the UI requires fetching and updating each affected task's `depends_on` individually, since the API only accepts `depends_on` on the task being updated.

### Key Types (`src/lib/domains/tasks/types/Task.types.ts`)

| Type | Key Fields |
|---|---|
| `ProjectResponse` | id, name, description, due_at, parent_id, started_at, finished_at |
| `ProjectDetailResponse` | Same + time_spent (aggregated) |
| `ProjectChildrenResponse` | project + children[] (mixed tasks and sub-projects) |
| `TaskDepRef` | id, name, due_at (dependency reference) |
| `TaskListItem` | id, name (for list-fast endpoint) |
| `TaskResponse` | id, name, description, due_at, project_id, started_at, finished_at, depends_on[], blocks[], blocked |
| `TaskFullResponse` | Same + time_spent, todos[] |
| `TodoResponse` | id, task_id, name, is_done |
| `TimeEntryResponse` | id, task_id, started_at, finished_at, comment |
| `ActiveTreeNode` | Recursive tree: id, type, name, children[], depends_on[], blocks[], blocked |
| `TaskByDueDateResponse` | Task with project_name, project_due_at, depends_on[], blocks[], blocked |

## Routes

| Route | Purpose |
|---|---|
| `/tasks` | Main page — timer, due-date list, active project tree |
| `/tasks/projects/[id]` | Project detail — edit project, view/create children |

## UI Components

### Tasks Page (`/tasks`)

```
┌─────────────────────────────────────┐
│  [💬] [Select task...        ] [✕]  │  ← Timer header
│  [Comment input]                    │
│  HH:MM ─ HH:MM  [+ Agregar]        │  ← Time entry row
│  00:12:34  [Started at]  [▶ Play]   │  ← Timer controls
│  Hoy: ██░░  Semana: ████░░  [📊]   │  ← Summary bars
├────────────────┬────────────────────┤
│ Próximas a     │ Proyectos activos  │
│ vencer    [+]  │              [+]   │
│                │                    │
│ Task items     │ Tree view          │
│ (click→sheet)  │ (proj→navigate,    │
│                │  task→sheet)       │
└────────────────┴────────────────────┘
```

- **"+" buttons**: Open CreateBottomSheet in task or project mode
- **Task click**: Opens TaskBottomSheet (half-modal)
- **Project click**: Navigates to `/tasks/projects/{id}`

### TaskBottomSheet (`src/lib/domains/tasks/components/TaskBottomSheet.svelte`)

Half-modal (BottomSheet) for viewing/editing a task.

```
┌─────────────────────────────────────┐
│ [📁 Project] Detalle de tarea   [✕] │  ← Title row with project link
│                                     │
│ Nombre: [____________]              │
│ Fecha límite: [datetime-local]      │
│ Descripción: [textarea]             │
│                                     │
│   Inicio         Fin      Tiempo    │  ← Info row (read-only)
│   22 mar 2026  [Finalizar]  12h 30m │
│                                     │
│ Depende de:                         │
│  [Task A ✕] [Task B ✕]             │  ← Removable pills
│  [▼ Agregar tarea...]               │  ← Select dropdown
│                                     │
│ Bloquea a:                          │
│  [Task C ✕]                         │
│  [▼ Agregar tarea...]               │
│                                     │
│ Todos:                              │
│ ☑ Todo 1  ☐ Todo 2  [+ Agregar]    │
│                                     │
│              [Eliminar] [Guardar]    │
└─────────────────────────────────────┘
```

- **Project link**: Inline chip at title level, navigates to project page
- **started_at / finished_at**: Read-only display when set. "Empezar"/"Finalizar" button when null — PATCHes to `now()`
- **Dependencies**: Two DepSelector sections — "Depende de" and "Bloquea a". Each shows selected tasks as removable pills + a `<select>` dropdown to add more. Saving syncs reverse deps by fetching+updating each affected task
- **Todos**: Checkbox toggle, delete, add new

### CreateBottomSheet (`src/lib/domains/tasks/components/CreateBottomSheet.svelte`)

Half-modal for creating tasks and projects.

- **Mode toggle**: Tarea / Proyecto (segmented control)
- **Fields**: Nombre, Descripción, Fecha límite + Proyecto/Proyecto padre selector (same row)
- **Dependencies** (task mode only): DepSelector for "Depende de" — select tasks from dropdown, shown as removable pills. Sent as `depends_on: number[]` on create
- **"Empezar ya" toggle**: When active, PATCHes `started_at: now()` after creation
- **Prefill**: When opened from a project page, project_id/parent_id are pre-selected for both modes

### Project Page (`/tasks/projects/[id]`)

Full page for project management.

```
┌─────────────────────────────────────┐
│ ← Tareas   ← Proyecto padre        │  ← Navigation
├─────────────────────────────────────┤
│ Nombre: [____________]              │
│ Fecha límite: [datetime-local]      │
│ Descripción: [textarea]             │
│                                     │
│   Inicio         Fin      Tiempo    │
│   22 mar 2026  [Finalizar]  12h 30m │
│                                     │
│              [Eliminar] [Guardar]    │
├─────────────────────────────────────┤
│ Hijos              [+ Tarea] [+ SP] │
│ 📁 Sub-project X → (navigate)      │
│ ✓ Task 1         → (open sheet)    │
│ ✓ Task 2         → (open sheet)    │
└─────────────────────────────────────┘
```

- **ESC key**: Navigates back to `/tasks` (unless a BottomSheet is open)
- **Children list**: Sub-projects link to their own page, tasks open TaskBottomSheet
- **Create buttons**: Open CreateBottomSheet with prefilled project context

### DepBadges (`src/lib/domains/tasks/components/DepBadges.svelte`)

Renders a row of clickable dependency pills for a task. Used in TaskItem, TreeNodeItem, and the project detail page. Badges appear between the task name and the project name.

- `deps: TaskDepRef[]` — dependencies to display
- `ondetail: (taskId) => void` — click handler (opens task detail)

### DepSelector (`src/lib/domains/tasks/components/DepSelector.svelte`)

Select dropdown + removable pills for editing task dependencies. Used in TaskBottomSheet (both directions) and CreateBottomSheet (depends_on only).

- `selected: TaskDepRef[]` — currently selected dependencies
- `onchange: (selected) => void` — callback with updated list
- `excludeId: number` — task ID to exclude from options (self)
- `label: string` — field label text
- Loads available tasks via `tasksApi.listTasksFast()` on mount

### BottomSheet (`src/lib/shared/components/BottomSheet.svelte`)

Shared half-modal component sliding up from bottom (max 60vh).

- `constrained` prop: When true, caps content at `max-w-5xl` (used by TaskBottomSheet and CreateBottomSheet, not by TimeHistoryModal)

## Timer (`src/lib/domains/tasks/taskTimer.svelte.ts`)

Client-side timer state using Svelte runes:

- Tracks selected task, elapsed time, active time entry ID
- `startTimer` / `stopTimer` / `cancelTimer` / `restore` / `updateStartedAt`
- Syncs with API: creates/updates/deletes time entries
- Restores active time entry on page load via `$effect`

## Time History

### TimeHistoryModal

Opens from chart icon on summary bars. Uses shared chart components (LayerCake).

- Frequency toggle (daily/weekly/monthly)
- Date range picker
- Calls `tasksApi.getTimeEntryHistory()`

## Shared Utilities

### `src/lib/shared/utils/datetime.ts`

| Function | Description |
|---|---|
| `toLocalDatetime(iso)` | ISO string → `datetime-local` input value |
| `toISOString(local)` | `datetime-local` value → UTC ISO string via `new Date(local).toISOString()` (or null) |
| `formatTime(seconds)` | Seconds → "Xh Xm" display |
| `formatDateShort(dateStr)` | Date → "22 mar" (short, for lists) |
| `formatDateFull(iso)` | Date → "22 mar 2026, 14:30" (full, for detail views) |

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/tasks/tree` | Active project/task tree |
| `GET` | `/tasks/tasks/by-due-date` | Tasks sorted by due date |
| `GET` | `/tasks/projects` | Root projects list |
| `GET` | `/tasks/projects/{id}` | Project detail with time_spent |
| `GET` | `/tasks/projects/{id}/children` | Project + child tasks/sub-projects |
| `POST` | `/tasks/projects` | Create project |
| `PATCH` | `/tasks/projects/{id}` | Update project |
| `DELETE` | `/tasks/projects/{id}` | Delete project |
| `GET` | `/tasks/tasks/list-fast` | All unfinished tasks (id, name only) |
| `GET` | `/tasks/tasks/{id}` | Task detail with todos + dependencies |
| `POST` | `/tasks/tasks` | Create task (accepts `depends_on: int[]`) |
| `PATCH` | `/tasks/tasks/{id}` | Update task (accepts `depends_on: int[]`) |
| `DELETE` | `/tasks/tasks/{id}` | Delete task |
| CRUD | `/tasks/todos` | Todo management |
| CRUD | `/tasks/time-entries` | Time entry management |
| `GET` | `/tasks/time-entries/active` | Currently running time entry |
| `GET` | `/tasks/time-entries/summary` | Today + week totals |
| `GET` | `/tasks/time-entries/history` | Aggregated history (daily/weekly/monthly) |

## Floating Reminder

Fixed-position note (top-right) showing today's cleaning task by day of week. Uses `FloatingReminder` component with a broom icon.
