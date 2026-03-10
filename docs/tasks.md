# Tasks

## Overview

Task time tracking — select a task, log time entries (start/end), and run a live timer.

## Data Model

### Hierarchy

```
Project (hierarchical via parent_id)
└── Task (belongs to a project)
    ├── Todo (subtask, boolean completion)
    └── TimeEntry (started_at, finished_at, comment)
```

### Key Types

| Type | Description |
|---|---|
| `Project` | id, name, parent_id (nullable for top-level) |
| `Task` | id, name, project_id |
| `Todo` | id, task_id, description, completed |
| `TimeEntry` | id, task_id, started_at, finished_at, comment |
| `ActiveTreeNode` | Recursive tree structure with `children: ActiveTreeNode[]` |

## UI Layout

```
┌─────────────────────────────────────┐
│  [Select task...]                   │  ← Task selector button
├─────────────────────────────────────┤
│  HH:MM ─ HH:MM                     │  ← Time entry row (TimePicker pairs)
│  HH:MM ─ HH:MM                     │
├─────────────────────────────────────┤
│  00:12:34          [▶ Play]         │  ← Timer display + controls
└─────────────────────────────────────┘
```

## TimePicker Component

A pair of number inputs for hours and minutes:

- **Hours**: 0–23
- **Minutes**: 0–59
- Colon separator between inputs
- Native spinner chrome hidden via CSS

## Timer

- Client-side `setInterval` updates the elapsed time display every second
- **Play** button (blue) starts the timer
- **Pause** button (red/danger) pauses the timer
- Display format: `HH:MM:SS`

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/tasks/tree` | Fetch active project/task tree |
| CRUD | `/projects` | Project management |
| CRUD | `/tasks` | Task management |
| CRUD | `/todos` | Todo/subtask management |
| CRUD | `/time-entries` | Time entry management |

## Current State

The tasks UI is a scaffold. Current limitations:

- Task selector is not yet functional (no dropdown/modal to pick tasks)
- Timer is client-side only — not persisted to the backend
- Time entries are not yet synced with the API
- Todo management is not yet implemented in the UI
