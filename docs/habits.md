# Habits

## Overview

Date-based habit tracking. View habits as cards, log numeric values per day.

## Data Model

**`HabitWithLog`** — the core type returned by the API:

| Field | Type | Description |
|---|---|---|
| `id` | number | Habit ID |
| `name` | string | Habit name |
| `description` | string \| null | Optional description |
| `log_value` | number \| null | Logged value for the selected date (`null` if unlogged) |

## UI Layout

```
┌─────────────────────────────────────┐
│       ◀  March 10, 2026  ▶  📅     │  ← DateNavigation
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ │ Habit 1 │ │ Habit 2 │ │ Habit 3│ │  ← Responsive card grid
│ │ desc... │ │         │ │        │ │    (1→2→3→4 columns)
│ │ [value] │ │ [value] │ │[value] │ │
│ └─────────┘ └─────────┘ └────────┘ │
└─────────────────────────────────────┘
```

- **DateNavigation**: prev/next buttons, clickable date text, calendar picker (Flowbite Datepicker), "Today" button
- **Card grid**: responsive columns — 1 column on mobile, scaling up to 4 on wide screens

## HabitCard Component

Each card displays:

- **Name** — habit title
- **Description** — shown below the name if present
- **Numeric input** — current log value; type a number to log

On value change, the component performs an **optimistic update** (immediately reflects the new value in the UI) then syncs to the API. On failure, the value reverts.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/habits?date=YYYY-MM-DD` | Fetch habits with log values for a date |
| `POST` | `/habits` | Create a new habit |
| `POST` | `/habits/log` | Log a value for a habit on a date |

## User Flow

1. Page loads → SSR fetches habits for today's date
2. User navigates to a different date → client-side fetch for that date
3. User types a value in a habit card → optimistic UI update
4. API call to `POST /habits/log` with `{ habit_id, date, value }`
5. On success, data refreshes; on failure, value reverts
