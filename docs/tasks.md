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

### Task Types

The `task_type` field controls behavior on completion:

| Type         | Badge color        | Completion action                                    |
| ------------ | ------------------ | ---------------------------------------------------- |
| `standard`   | `--color-primary`  | Sets `finished_at`                                   |
| `continuous` | `--color-continuous` | Sets `finished_at` (same as standard)              |
| `recurring`  | `--color-recurring`  | Reschedules (`due_at = today + recurrence`) in "Próximas a vencer" / "Proyectos activos" — the button is labeled "Renovar" there. Sets `finished_at` everywhere else. Requires `recurrence: number` (days) |

Status labels are produced by `getStatusLabel()` in `src/lib/domains/tasks/utils/statusLabel.ts`. The agenda uses a shortened "Recurrente · N".

### Task Priority

Tasks have a `priority: number` field, 1 (highest/most urgent) to 5 (lowest), default `3`. Always present on every task response. `ActiveTreeNode` and `ProjectChildNode` type it as optional since the API emits `omitempty` for those.

**Editing**: Prioridad `<select>` in both `CreateBottomSheet` and `TaskBottomSheet`, placed in the inline row with Tipo. Create only sends the field when non-default (kept consistent with how `task_type` is omitted when standard); update always sends it.

**Display**: `.priority-badge` with `P{n}` label next to `.status-badge` on `TaskItem` and `TreeNodeItem`. `.p-1` uses danger red; `.p-2` uses warning amber; 3–5 stay muted.

**Filtering on `/tasks`**: "Próximas a vencer" and "Proyectos activos" each have a `.priority-filter` pill group (`Todas · ≤1 · ≤2 · ≤3 · ≤4`). Filtering is **client-side** via `$derived` on the already-loaded SSR data — instant, no round-trip. The tree filter keeps all projects regardless of their children's priorities (matches the API's `min_priority` semantics on `/tasks/tree`). Server-side support exists (`?min_priority=N` on `/tasks/tree` and `/tasks/tasks/by-due-date`) but is currently unused from the frontend.

### Key Types (`src/lib/domains/tasks/types/Task.types.ts`)

| Type                      | Key Fields                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `ProjectResponse`         | id, name, description, due_at, parent_id, started_at, finished_at                                   |
| `ProjectDetailResponse`   | Same + time_spent (aggregated)                                                                      |
| `ProjectChildrenResponse` | project + children[] (mixed tasks and sub-projects)                                                 |
| `TaskDepRef`              | id, name, due_at (dependency reference)                                                             |
| `TaskListItem`            | id, name, project_id, project_name, task_type?, recurrence?, priority? (for list-fast endpoint)     |
| `TaskResponse`            | id, name, description, due_at, project_id, started_at, finished_at, task_type, recurrence?, priority, depends_on[], blocks[], blocked |
| `TaskFullResponse`        | Same + time_spent, todos[]                                                                          |
| `TodoResponse`            | id, task_id, name, is_done                                                                          |
| `TimeEntryResponse`       | id, task_id, started_at, finished_at, comment                                                       |
| `ActiveTreeNode`          | Recursive tree: id, type, name, task_type?, recurrence?, priority?, children[], depends_on[], blocks[], blocked |
| `TaskByDueDateResponse`   | Task with project_name, project_due_at, task_type, recurrence?, priority, depends_on[], blocks[], blocked |
| `TimeEntryWithTask`       | Time entry with task_name, project_name, task_finished_at, time_spent                               |

## Routes

| Route                  | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `/tasks`               | Main page — timer, due-date list, active project tree |
| `/tasks/projects/[id]` | Project detail — edit project, view/create children   |

## UI Components

### Tasks Page (`/tasks`)

```
┌─────────────────────────────────────┐
│  [💬] [Select task...        ] [✕]  │  ← Timer header
│  [Comment input]                    │
│  HH:MM ─ HH:MM  [+ Agregar]        │  ← Time entry row
│  00:12:34  [Started at]  [▶ Play]   │  ← Timer controls
│  Hoy: ██░░  Semana: ████░░  [📊][📅]│  ← Summary bars + agenda
├────────────────────────┬────────────────────────┤
│ Próximas a vencer      │ Proyectos activos      │
│ [Todas ≤1 ≤2 ≤3 ≤4][+] │ [Todas ≤1 ≤2 ≤3 ≤4][+] │
│                        │                        │
│ Task items (with P{n}) │ Tree view (with P{n})  │
│ (click→sheet)          │ (proj→navigate,        │
│                        │  task→sheet)           │
└────────────────────────┴────────────────────────┘
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
- **Description view/edit toggle**: When a description exists, the sheet renders it as linkified read-only text (`.desc-view`) with an edit button. Clicking edit swaps in a textarea; blurring with content returns to view mode. Empty descriptions open directly in edit mode.
- **Todos**: Checkbox toggle, delete, add new

### CreateBottomSheet (`src/lib/domains/tasks/components/CreateBottomSheet.svelte`)

Half-modal for creating tasks and projects.

- **Mode toggle**: Tarea / Proyecto (segmented control)
- **Fields**: Nombre, Descripción, inline row (Fecha límite + Proyecto/Proyecto padre + Tipo + Cada días [when recurring] + Prioridad)
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

- **`?task={id}` query param**: Auto-opens TaskBottomSheet for the given task (used by agenda navigation)
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

### RightSheet (`src/lib/shared/components/RightSheet.svelte`)

Shared side panel sliding in from the right (420px / 90vw, full height). Same API pattern as BottomSheet.

- Props: `open: boolean`, `onclose: () => void`, `children: Snippet`
- Both BottomSheet and RightSheet share `@utility` base styles: `sheet-backdrop`, `sheet-close`, `sheet-base`

### AgendaRightSheet (`src/lib/domains/tasks/components/AgendaRightSheet.svelte`)

Right-sliding panel showing a chronological timeline of time entries (most recent first).

- Opens from calendar-day icon button next to the chart button in summary-actions
- **Mode toggle**: Day (24h) / Week (7 days) — icon button inline with subtitle, re-fetches on toggle
- Entries sorted by full `started_at` timestamp (date-aware, not just hour)
- Each entry shows: task name, project name, time range, status badge (En progreso / Finalizada), duration
- Colored left bar per entry: blue (in progress), green (task finished), pulsing (entry still running)
- **Hour labels**: Left column shows `HH:00` when the hour changes between entries
- **Gap indicators**: Between entries with >2 min gap, shows idle time. Gaps ≥1h also show the time range (e.g. `14:30 – 17:00 · 2h 30m`)
- **Day dividers**: When entries cross midnight, gap is split at 00:00 with a day label (e.g. `Miércoles 8/4`) between the two halves
- Click: if task has a project, navigates to `/tasks/projects/{id}?task={taskId}` (auto-opens TaskBottomSheet); otherwise opens TaskBottomSheet in place
- Calls `tasksApi.getTimeEntries({ start_time })` with `toLocalDateString(now - 24h|7d)`

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

## Description Linkification

Task and project descriptions run through `linkify()` (`src/lib/shared/utils/linkify.ts`) before rendering, turning URLs into anchor tags with short, readable labels.

- **Regex**: matches `https?://` and `file://` URLs, stripping trailing punctuation (`.,;:!?)`)
- **Short labels**: `hostname/…/last-segment` for web URLs, `…/last-segment` for `file://`. URL-decoded so spaces and unicode render cleanly. Full URL is preserved in the `title` attribute
- **Space handling**: raw URLs with spaces are encoded to `%20` so the `href` is valid
- **Escaping**: both the `href` and visible label are HTML-escaped to prevent injection
- **`file://` clipboard fallback**: browsers block navigation to `file://` URLs, so `installLinkifyHandler()` (called once from the root layout) installs a document-level click listener on `a.linkify-file` that `preventDefault`s and copies the URL to the clipboard via `navigator.clipboard.writeText`, with a success/error toast
- **Styles**: `.linkify-link` / `.linkify-file` in `tasks.css`; `.desc-view` wraps the rendered HTML in `TaskBottomSheet`

Used by TaskItem, TreeNodeItem, TaskBottomSheet, and project detail pages.

## Overdue Indicator

Tasks with `due_at < today` appear in red on "Próximas a vencer". `TaskItem` adds a `.overdue` class alongside the existing `.today` class when `isOverdue` is true, styled in `tasks.css`. The indicator does not apply to tasks without a due date or to tasks in the active-project tree.

## Shared Utilities

### `src/lib/shared/utils/datetime.ts`

| Function                   | Description                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `toLocalDatetime(iso)`     | ISO string → `datetime-local` input value (slices to `YYYY-MM-DDTHH:MM`, no tz conversion)       |
| `toISOString(local)`       | `datetime-local` value → ISO string preserving local date/time via offset compensation (or null) |
| `toLocalDateString(date)`  | Date object → local `YYYY-MM-DD` (avoids UTC day-shift from `toISOString().split('T')[0]`)       |
| `formatTime(seconds)`      | Seconds → "Xh Xm" display                                                                        |
| `formatDateShort(dateStr)` | Date → "22 mar" (short, for lists)                                                               |
| `formatDateFull(iso)`      | Date → "22 mar 2026, 14:30" (full, for detail views)                                             |

### `src/lib/shared/utils/linkify.ts`

| Function                  | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `linkify(text)`           | Wraps URLs in `<a>` tags with short labels; returns HTML-safe string        |
| `installLinkifyHandler()` | Idempotent document-level click handler for `file://` links (clipboard copy) |

## API Endpoints

| Method   | Endpoint                                    | Purpose                                      |
| -------- | ------------------------------------------- | -------------------------------------------- |
| `GET`    | `/tasks/tree`                               | Active project/task tree (accepts `?min_priority=N`) |
| `GET`    | `/tasks/tasks/by-due-date`                  | Tasks sorted by due date (accepts `?min_priority=N`) |
| `GET`    | `/tasks/projects`                           | Root projects list                           |
| `GET`    | `/tasks/projects/{id}`                      | Project detail with time_spent               |
| `GET`    | `/tasks/projects/{id}/children`             | Project + child tasks/sub-projects           |
| `POST`   | `/tasks/projects`                           | Create project                               |
| `PATCH`  | `/tasks/projects/{id}`                      | Update project                               |
| `DELETE` | `/tasks/projects/{id}`                      | Delete project                               |
| `GET`    | `/tasks/tasks/list-fast`                    | All unfinished tasks (id, name only)         |
| `GET`    | `/tasks/tasks/{id}`                         | Task detail with todos + dependencies        |
| `POST`   | `/tasks/tasks`                              | Create task (accepts `depends_on: int[]`)    |
| `PATCH`  | `/tasks/tasks/{id}`                         | Update task (accepts `depends_on: int[]`)    |
| `DELETE` | `/tasks/tasks/{id}`                         | Delete task                                  |
| CRUD     | `/tasks/todos`                              | Todo management                              |
| CRUD     | `/tasks/time-entries`                       | Time entry management                        |
| `GET`    | `/tasks/time-entries/active`                | Currently running time entry                 |
| `GET`    | `/tasks/time-entries/summary`               | Today + week totals                          |
| `GET`    | `/tasks/time-entries/history`               | Aggregated history (daily/weekly/monthly)    |
| `GET`    | `/tasks/time-entries?start_time=&end_time=` | Time entries with task/project info (agenda) |

## Floating Reminder

Fixed-position note (top-right) showing today's cleaning task by day of week. Uses `FloatingReminder` component with a broom icon.
