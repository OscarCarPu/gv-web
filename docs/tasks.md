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

| Type         | Badge color          | Completion action                                                                                                                                                                                          |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard`   | `--color-primary`    | Sets `finished_at`                                                                                                                                                                                         |
| `continuous` | `--color-continuous` | Sets `finished_at` (same as standard)                                                                                                                                                                      |
| `recurring`  | `--color-recurring`  | Reschedules (`due_at = today + recurrence`) in "Próximas a vencer" / "Proyectos activos" — the button is labeled "Renovar" there. Sets `finished_at` everywhere else. Requires `recurrence: number` (days) |

Status labels are produced by `getStatusLabel()` in `src/lib/domains/tasks/utils/statusLabel.ts`. The agenda uses a shortened "Recurrente · N".

### Task Priority

Tasks have a `priority: number` field, 1 (highest/most urgent) to 5 (lowest), default `3`. Always present on every task response. `ActiveTreeNode` and `ProjectChildNode` type it as optional since the API emits `omitempty` for those.

**Editing**: Prioridad `<select>` in both `CreateBottomSheet` and `TaskBottomSheet`, placed in the inline row with Tipo. Create only sends the field when non-default (kept consistent with how `task_type` is omitted when standard); update always sends it.

**Display**: `.priority-badge` with `P{n}` label next to `.status-badge` on `TaskItem` and `TreeNodeItem`. `.p-1` uses danger red; `.p-2` uses warning amber; 3–5 stay muted.

**Filtering on `/tasks`**: "Próximas a vencer" and "Proyectos activos" each have a `.priority-filter` pill group (`Todas · ≤1 · ≤2 · ≤3 · ≤4`). Filtering is **client-side** via `$derived` on the already-loaded SSR data — instant, no round-trip. The tree filter keeps all projects regardless of their children's priorities (matches the API's `min_priority` semantics on `/tasks/tree`). Server-side support exists (`?min_priority=N` on `/tasks/tree` and `/tasks/tasks/by-due-date`) but is currently unused from the frontend.

### Estimate & Urgency ("Due Soon")

`standard` tasks can carry an optional `estimate_hours` (decimal string, same convention as money fields) — an "Estimate (hours)" number input (`step="0.5"`) in both `CreateBottomSheet` and `TaskBottomSheet`, shown only when `task_type === 'standard'`. `continuous` and `recurring` tasks never show or send the field.

The API computes urgency server-side from the estimate, the daily capacity constant, and hours already spoken for by `plan_blocks` (see [calendar.md](calendar.md) — the capacity domain lives there), and returns it on every `TaskByDueDateResponse`: `remaining_hours` (estimate minus time already spent/planned), `start_by` (the date by which the task must be started to still make its deadline given free hours between now and `due_at`), and `urgent` (boolean — `start_by` has arrived or passed). None of this is computed on the frontend; the client only renders it.

`TaskItem` adds an `.urgent` class (alongside `.today`/`.overdue`) when `task.urgent` is true, styled in `tasks.css` as a warning-tinted border/background — distinct from `.overdue`'s red, since urgent means "should have started" rather than "past its deadline" (`.urgent:not(.overdue)` so a task that's both stays red).

### Key Types (`src/lib/domains/tasks/types/Task.types.ts`, `Plan.types.ts`)

| Type                          | Key Fields                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProjectResponse`             | id, name, description, due_at, parent_id, started_at, finished_at                                                                                                                                                                             |
| `ProjectDetailResponse`       | Same + time_spent (aggregated)                                                                                                                                                                                                                |
| `ProjectChildrenResponse`     | project + children[] (mixed tasks and sub-projects)                                                                                                                                                                                           |
| `TaskDepRef`                  | id, name, due_at (dependency reference)                                                                                                                                                                                                       |
| `TaskListItem`                | id, name, project_id, project_name, task_type?, recurrence?, priority? (for list-fast endpoint)                                                                                                                                               |
| `TaskResponse`                | id, name, description, due_at, project_id, started_at, finished_at, task_type, recurrence?, priority, estimate_hours, depends_on[], blocks[], blocked                                                                                         |
| `TaskFullResponse`            | Same + time_spent, todos[]                                                                                                                                                                                                                    |
| `TodoResponse`                | id, task_id, name, is_done                                                                                                                                                                                                                    |
| `TimeEntryResponse`           | id, task_id, started_at, finished_at, comment                                                                                                                                                                                                 |
| `ActiveTreeNode`              | Recursive tree: id, type, name, task_type?, recurrence?, priority?, children[], depends_on[], blocks[], blocked                                                                                                                               |
| `TaskByDueDateResponse`       | Task with project_name, project_due_at, task_type, recurrence?, priority, depends_on[], blocks[], blocked, estimate_hours, remaining_hours, start_by, urgent (see [Estimate & Urgency](#estimate--urgency-due-soon))                          |
| `TimeEntryWithTask`           | Time entry with task_name, project_name, task_finished_at, time_spent                                                                                                                                                                         |
| `PaceBreakdown`               | uniform_per_day_seconds, uniform_today_share_seconds, weighted_weekday_seconds, weighted_weekend_seconds, weighted_today_share_seconds, remaining_full_days, goal_reached                                                                     |
| `TimeEntrySummaryResponse`    | today, week, daily_target_seconds, weekly_target_seconds, pace (PaceBreakdown). Computed server-side — see [Plan Block subsystem](#plan-block-subsystem)                                                                                      |
| `PlanBlockResponse`           | id, plan_date, started_at, ended_at, task_id, task_name, label, note, event_ref, commitment_id, task_type, task_recurrence, task_started_at, task_finished_at (joined task fields are read-only, always present, `null` for free-time blocks) |
| `PlanRangeResponse`           | from, to, blocks[] — same shape as `PlanTodayResponse.blocks` but across an arbitrary date range, used by the calendar page (see [calendar.md](calendar.md))                                                                                  |
| `RecurringCommitmentResponse` | id, task_id, task_name, label, days_of_week[] (0=Sun..6=Sat), start_time, end_time, active                                                                                                                                                    |
| `CreateCommitmentRequest`     | task_id, label, days_of_week[], start_time, end_time                                                                                                                                                                                          |
| `UpdateCommitmentRequest`     | label?, days_of_week?, start_time?, end_time?, active? — no `task_id`; a commitment's task can't be changed after creation                                                                                                                    |
| `PlanTotals`                  | task_seconds (sum of linked-block durations), free_seconds (sum of free-time-block durations)                                                                                                                                                 |
| `PlanTodayResponse`           | date (YYYY-MM-DD), blocks[], totals (PlanTotals), budget (TimeEntrySummaryResponse)                                                                                                                                                           |
| `CreatePlanBlockRequest`      | started_at, ended_at, task_id?, label?, note?, event_ref?                                                                                                                                                                                     |
| `UpdatePlanBlockRequest`      | started_at?, ended_at?, task_id?, clear_task?, label?, note?, clear_note?                                                                                                                                                                     |

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
│ Próximas a vencer      │ Plan de hoy            │
│ [Todas ≤1 ≤2 ≤3 ≤4][+] │ [+ Bloque]             │
│                        │ Estim: ██░░ / 11h 52m  │
│ Task items (with P{n}) │ Libre: 2h              │
│ (click→sheet)          │ ───────────────────    │
│                        │ Plan blocks (current   │
│                        │ block has primary      │
│                        │ border; "now" line     │
│                        │ shown only when no     │
│                        │ block is in progress)  │
├────────────────────────┴────────────────────────┤
│ Proyectos activos                   [+ Proyecto]│
│ [Todas ≤1 ≤2 ≤3 ≤4]                             │
│ Tree view (with P{n})                           │
│ (proj→navigate, task→sheet)                     │
└─────────────────────────────────────────────────┘
```

- **"+" buttons**: Open CreateBottomSheet in task or project mode (or PlanBlockEditor for "+ Bloque")
- **Task click**: Opens TaskBottomSheet (half-modal)
- **Project click**: Navigates to `/tasks/projects/{id}`
- **Layout**: "Próximas a vencer" and "Plan de hoy" share the top row (2-col on desktop, stacked on mobile); "Proyectos activos" is a full-width section below (`.tasks-content.tasks-content-wide`)

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

## Plan Block subsystem

Always-visible "Plan de hoy" section on `/tasks`. The plan is a list of time-boxed blocks scheduled across today; each block is either **linked** (points at a task — gets ▶/✓ shortcuts that call the existing task endpoints) or **free-time** (carries only a label like "comer", "thing 1"). The plan never mutates `tasks` or `time_entries` — it is a read-only mirror of intent.

### Server-side rendering and data flow

- `+page.server.ts` calls `planApi.getToday(token)` in parallel with the existing tasks/summary loads and adds `plan` to the page data. Falls back to `null` on error.
- `PlanSection` reads `data.plan` via `let data = $derived(initial)` — single source of truth on the server. After every CRUD mutation (create/update/delete in the editor, ▶/✓ on a linked block, ▶ Iniciar timer), the section calls `onafterchange()` which the page wires to `invalidateAll()`. SvelteKit re-runs the server load, the new `data.plan` propagates through the prop, and the `$derived` data updates without any local refetch.
- This client-loaded variant (calling `planApi.getToday()` from a `$effect` on mount) was abandoned because it raced with `setClientToken()` in the root layout — the `Authorization` header was empty on first mount and the API returned 401.

### Estimate row + "now" line

- `nowMs` is a `$state` updated every 60 s by an interval inside `$effect` (cleaned up on unmount). Drives the estimate calculation and the "now" line.
- The summary shows two rows: **Estim.** = `summary.today` (real, finished time entries) + `futureTaskSeconds` (sum of durations of linked plan blocks where `started_at >= now`) over `daily_target_seconds`; **Libre** = `totals.free_seconds`. The progress bar turns primary-green when `estimatedTotal >= daily_target_seconds` (going over target is _not_ red — exceeding the goal is the goal).
- The block list highlights the current block (where `started_at <= now < ended_at`) with `.plan-block-current` (primary-tinted border + background, same look as `.task-item.today`). When no block is currently active, a horizontal "now" line is rendered before the first block whose `started_at > now` (or after the last block if `now` is past everything). The line never appears when a current block exists — the highlighted border is the visual cue instead.

### Components

#### PlanSection (`src/lib/domains/tasks/components/PlanSection.svelte`)

- Props: `initial: PlanTodayResponse | null`, `ontimerstart`, `onafterchange`, `isTimerRunning`.
- Renders the section header ("Plan de hoy" + `+ Bloque` button), the summary rows, and the block list.
- Linked block actions: Empezar / Acabar / Renovar (matches `TaskItem` semantics — uses the joined `task_started_at`, `task_type`, `task_recurrence` to choose the label) and Iniciar / Asignar (timer). Both are implemented inside the section by calling `tasksApi.updateTask(...)` and the `ontimerstart` prop directly — no proxy through the plan service. Disabled when `task_finished_at` is set.
- Free-time blocks render the label, duration, and an inline note (truncated). No action buttons, just edit/delete.
- All edit/delete go through `planApi`, then `await onafterchange()` to refresh the SSR data.

#### PlanBlockEditor (`src/lib/domains/tasks/components/PlanBlockEditor.svelte`)

Modal for creating and editing a single block.

- Mode toggle: **Tarea** / **Tiempo libre**. Switches between showing a task selector + optional label override, or a free-text "Qué harás" label.
- Two `<input type="time">` for start/end (today's date is implied — the section is today-only).
- Task selector loads via `tasksApi.listTasksFast()` on open (same source as `DepSelector`), grouped by project name.
- Selecting a task auto-fills the label with the task's name; the user can override.
- On submit, calls `planApi.createBlock` or `planApi.updateBlock`. Backend validation errors (`ended_at must be after started_at`, `plan block overlaps with an existing one`, `task not found`, etc.) are surfaced via toast.
- Cancel uses `.btn-outline` (proper-width text button) — not `.btn-cancel` which is icon-shaped.

### API client (`src/lib/domains/tasks/api/plan.api.ts`)

Standard `fetchAPI` wrappers, all behind the full-private auth token.

| Method | Endpoint                 | Wrapper                                       |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/plan/today`            | `planApi.getToday(token?)`                    |
| GET    | `/plan/range`            | `planApi.getRange(from, to, token?)`          |
| POST   | `/plan/blocks`           | `planApi.createBlock(input, token?)`          |
| PUT    | `/plan/blocks/{id}`      | `planApi.updateBlock(id, input)`              |
| DELETE | `/plan/blocks/{id}`      | `planApi.deleteBlock(id)`                     |
| GET    | `/plan/commitments`      | `planApi.listCommitments(token?)`             |
| POST   | `/plan/commitments`      | `planApi.createCommitment(input, token?)`     |
| PUT    | `/plan/commitments/{id}` | `planApi.updateCommitment(id, input, token?)` |
| DELETE | `/plan/commitments/{id}` | `planApi.deleteCommitment(id, token?)`        |

Zod schemas live in `src/lib/domains/tasks/api/plan.schemas.ts` (`PlanBlockResponseSchema`, `PlanTotalsSchema`, `PlanTodayResponseSchema`, `PlanRangeResponseSchema`, `RecurringCommitmentResponseSchema`); reuses `TimeEntrySummaryResponseSchema` for the `budget` field.

The `/capacity/free-busy` domain lives outside `tasks`/`plan` entirely — its client (`capacityApi`, `src/lib/domains/capacity/`) is documented in [calendar.md](calendar.md), the only place it's currently consumed.

### Pace tooltip (`src/lib/domains/tasks/utils/paceLabel.ts`)

`buildPaceTooltip(summary)` is a pure formatter that builds the Spanish pace tooltip rendered next to the weekly progress bar in the timer panel. It only consumes the numbers from `summary.pace` and `summary.weekly_target_seconds - summary.week`, applying `formatTime()` for each segment. All math (uniform-per-day, today's share, weekday/weekend distribution under the 80h/week goal) lives on the server in `internal/tasks/budget.go`.

Three rendering branches:

| Condition                        | Output                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pace.goal_reached === true`     | `Meta alcanzada ✓`                                                                                                                  |
| `pace.remaining_full_days === 0` | `{remaining} hoy` — last day of the week, every remaining second has to land today                                                  |
| Otherwise                        | `{uniform_per_day}/día · {uniform_today_share} hoy \| {weighted_weekday} L-V · {weighted_weekend} S-D · {weighted_today_share} hoy` |

This replaces ~40 lines of arithmetic that previously lived in `+page.svelte`. Constants (`288000`, `43200`, `28800`, `17h/12h waking`) are now exclusively on the server.

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

| Function                  | Description                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| `linkify(text)`           | Wraps URLs in `<a>` tags with short labels; returns HTML-safe string         |
| `installLinkifyHandler()` | Idempotent document-level click handler for `file://` links (clipboard copy) |

### `src/lib/domains/tasks/utils/paceLabel.ts`

| Function                    | Description                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildPaceTooltip(summary)` | Formats the Spanish pace tooltip from `summary.pace`. Pure formatter — no arithmetic. See [Pace tooltip](#pace-tooltip-srclibdomainstasksutilspacelabelts). |

## API Endpoints

| Method   | Endpoint                                    | Purpose                                                                              |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET`    | `/tasks/tree`                               | Active project/task tree (accepts `?min_priority=N`)                                 |
| `GET`    | `/tasks/tasks/by-due-date`                  | Tasks sorted by due date (accepts `?min_priority=N`)                                 |
| `GET`    | `/tasks/projects`                           | Root projects list                                                                   |
| `GET`    | `/tasks/projects/{id}`                      | Project detail with time_spent                                                       |
| `GET`    | `/tasks/projects/{id}/children`             | Project + child tasks/sub-projects                                                   |
| `POST`   | `/tasks/projects`                           | Create project                                                                       |
| `PATCH`  | `/tasks/projects/{id}`                      | Update project                                                                       |
| `DELETE` | `/tasks/projects/{id}`                      | Delete project                                                                       |
| `GET`    | `/tasks/tasks/list-fast`                    | All unfinished tasks (id, name only)                                                 |
| `GET`    | `/tasks/tasks/{id}`                         | Task detail with todos + dependencies                                                |
| `POST`   | `/tasks/tasks`                              | Create task (accepts `depends_on: int[]`)                                            |
| `PATCH`  | `/tasks/tasks/{id}`                         | Update task (accepts `depends_on: int[]`)                                            |
| `DELETE` | `/tasks/tasks/{id}`                         | Delete task                                                                          |
| CRUD     | `/tasks/todos`                              | Todo management                                                                      |
| CRUD     | `/tasks/time-entries`                       | Time entry management                                                                |
| `GET`    | `/tasks/time-entries/active`                | Currently running time entry                                                         |
| `GET`    | `/tasks/time-entries/summary`               | Today + week totals + daily/weekly target + pace breakdown                           |
| `GET`    | `/tasks/time-entries/history`               | Aggregated history (daily/weekly/monthly)                                            |
| `GET`    | `/tasks/time-entries?start_time=&end_time=` | Time entries with task/project info (agenda)                                         |
| `GET`    | `/plan/today`                               | Today's plan blocks + totals + budget                                                |
| `GET`    | `/plan/range`                               | Plan blocks across an arbitrary date range (used by `/calendar`, not `/tasks`)       |
| `POST`   | `/plan/blocks`                              | Create a plan block (accepts `event_ref` to link a calendar event)                   |
| `PUT`    | `/plan/blocks/{id}`                         | Update a plan block                                                                  |
| `DELETE` | `/plan/blocks/{id}`                         | Delete a plan block                                                                  |
| `GET`    | `/plan/commitments`                         | List recurring commitments                                                           |
| `POST`   | `/plan/commitments`                         | Create a recurring commitment                                                        |
| `PUT`    | `/plan/commitments/{id}`                    | Update a recurring commitment (no `task_id`)                                         |
| `DELETE` | `/plan/commitments/{id}`                    | Delete a recurring commitment                                                        |
| `GET`    | `/capacity/free-busy`                       | Daily capacity/busy/free breakdown for a date range (see [calendar.md](calendar.md)) |

## Floating Reminder

Fixed-position note (top-right) showing today's cleaning task by day of week. Uses `FloatingReminder` component with a broom icon.
