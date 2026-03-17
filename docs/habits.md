# Habits

## Overview

Date-based habit tracking. View habits as cards, log numeric values per day. Supports targets, progress visualization, and streak tracking.

## Data Model

**`HabitWithLog`** — the core type returned by the API:

| Field | Type | Description |
|---|---|---|
| `id` | number | Habit ID |
| `name` | string | Habit name |
| `description` | string \| null | Optional description |
| `frequency` | string | Tracking frequency: `daily`, `weekly`, or `monthly` |
| `target_min` | number \| null | Minimum target value per period |
| `target_max` | number \| null | Maximum target value per period |
| `recording_required` | boolean | Whether missing days break the streak |
| `log_value` | number \| null | Logged value for the selected date (`null` if unlogged) |
| `period_value` | number | Sum of log values within the current period |
| `current_streak` | number | Consecutive completed periods |
| `longest_streak` | number | All-time highest streak |

**`CreateHabitRequest`** — payload for creating a new habit:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Habit name |
| `description` | string \| null | no | Optional description |
| `frequency` | string | no | `daily` (default), `weekly`, or `monthly` |
| `target_min` | number \| null | no | Minimum target per period |
| `target_max` | number \| null | no | Maximum target per period |
| `recording_required` | boolean | no | Default `true` |

## Floating Reminder

A fixed-position note in the top-right corner displaying "Limpiar dientes" with a tooth icon. Uses the shared `FloatingReminder` component (`src/lib/shared/components/FloatingReminder.svelte`). Always visible — not day-dependent.

## UI Layout

```
┌─────────────────────────────────────┐
│       ◀  March 10, 2026  ▶  📅     │  ← DateNavigation
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ │ Habit 1 │ │ Habit 2 │ │ Habit 3│ │  ← Responsive card grid
│ │ desc... │ │         │ │        │ │    (1→2→3→4 columns)
│ │ [value] │ │ [value] │ │[value] │ │
│ │ ████░░  │ │ ████████│ │ ██████ │ │  ← Progress bar
│ │ 🔥3 🏆12│ │ 🔥7 🏆14│ │🔥2 🏆5│ │  ← Streaks
│ └─────────┘ └─────────┘ └────────┘ │
└─────────────────────────────────────┘
```

- **DateNavigation**: prev/next buttons, clickable date text, calendar picker (Flowbite Datepicker), "Today" button
- **Card grid**: responsive columns — 1 column on mobile, scaling up to 4 on wide screens

## HabitCard Component

Each card displays:

- **Name** — habit title
- **Frequency badge** — shown next to the name for non-daily habits (`weekly`, `monthly`)
- **Description** — shown below the name if present
- **Value controls** — +/- buttons and a numeric input for the current day's log value
- **Progress bar** — shown only for habits with targets (see below)
- **Period value** — for non-daily habits without targets, shows the accumulated period value (e.g. "weekly: 5")
- **Streaks** — shown only for habits with targets: current streak (fire icon) and longest streak (trophy icon)

### Optimistic Updates

On value change, the component performs an **optimistic update** — immediately reflects the new value in the UI, including recalculated progress and period value. On API failure, the value reverts.

The `optimisticPeriodValue` is derived by adjusting the server-provided `period_value` with the delta between the optimistic and actual log values.

### Progress Bar

Only displayed when the habit has at least one target (`target_min` or `target_max`).

**Progress calculation** varies by target type:

| Target Type | Progress Formula |
|---|---|
| Range (`min` + `max`) | Position within `[min, max]`, 0–100% |
| Min-only | `periodValue / min`, capped at 100% |
| Max-only | `periodValue / max`, capped at 100% |

**Color states** (mutually exclusive):

| State | CSS Class | Color | Condition |
|---|---|---|---|
| Default | — | Blue (`bg-primary`) | Target not yet met |
| Met | `.met` | Green (`bg-green-500`) | Period value satisfies target criteria |
| Exceeded | `.exceeded` | Red (`bg-red-500`) | Period value exceeds `target_max` |

`targetMet` returns `false` when value > max, so `met` and `exceeded` are mutually exclusive.

**Progress text** shows the current period value alongside the target:

| Target Type | Format | Example |
|---|---|---|
| Range | `value (min-max)` | `3 (2-5)` |
| Min-only | `value/min` | `3/5` |
| Max-only | `value/max` | `1500/2000` |

### Streaks

Shown only for habits with targets. Two indicators:

- **Current streak** (fire icon): consecutive completed periods. Orange when active (> 0), muted otherwise.
- **Longest streak** (trophy icon): all-time best, always shown in muted/smaller text.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/habits?date=YYYY-MM-DD` | Fetch habits with log values for a date |
| `POST` | `/habits` | Create a new habit |
| `POST` | `/habits/log` | Log a value for a habit on a date |
| `DELETE` | `/habits/{id}` | Delete a habit and its logs |

## User Flow

1. Page loads → SSR fetches habits for today's date
2. User navigates to a different date → client-side fetch for that date
3. User types a value or clicks +/- in a habit card → optimistic UI update
4. API call to `POST /habits/log` with `{ habit_id, date, value }`
5. On success, data refreshes; on failure, value reverts
