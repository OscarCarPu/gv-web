# Styling

## Overview

All styles live in global CSS files under `src/styles/`. No scoped `<style>` blocks in components. Tailwind CSS 4 with `@theme` tokens in `app.css`.

## File Organization

| File             | Scope                                                      | Loaded               |
| ---------------- | ---------------------------------------------------------- | -------------------- |
| `app.css`        | Theme tokens, base styles, date navigation                 | Root layout (always) |
| `components.css` | Shared UI: buttons, modals, toggles, progress bars, toasts | Root layout (always) |
| `habits.css`     | Habit cards, grid layout, streaks                          | `/habits` layout     |
| `tasks.css`      | Timer, task items, tree, forms, project pages              | `/tasks` layout      |
| `varieties.css`  | Ranking list, variety cards, score grid                    | `/varieties` layout  |
| `login.css`      | Login/2FA form                                             | `/login` pages       |

Feature CSS files use `@reference "./app.css"` to access theme tokens without duplicating Tailwind output.

## Theme Tokens (`app.css`)

```css
--color-primary: #3b82f6; /* Blue — buttons, links, active states */
--color-secondary: #a78bfa; /* Purple — badges, secondary highlights */
--color-bg: #0b0f1a; /* Ultra-dark background */
--color-bg-light: #141926; /* Card/panel background */
--color-surface: #1a2033; /* Elevated surface */
--color-text: #e8ecf4; /* Primary text */
--color-text-muted: #7b8ba5; /* Secondary text */
--color-success: #34d399; /* Completed/met states */
--color-info: #3b82f6; /* Informational */
--color-danger: #f87171; /* Destructive/exceeded */
--color-warning: #fbbf24; /* Caution/flags */
--color-continuous: #2dd4bf; /* Teal — continuous task type badge */
--color-recurring: #f59e0b; /* Amber — recurring task type badge */
--color-border: rgba(255, 255, 255, 0.06); /* Default borders */
--color-border-light: rgba(255, 255, 255, 0.08); /* Slightly visible borders */
--font-sans: 'Inter'; /* Body text */
--font-mono: 'JetBrains Mono'; /* Timers, numbers */
--breakpoint-desktop: 1000px; /* Single breakpoint */
```

## Z-Index Scale

```
z-10  App header (sticky nav)
z-40  Floating reminders, toasts
z-50  Modals, bottom sheets, right sheets, overlays
```

## Breakpoints

**One breakpoint, two states.** There is no `mobile` / `tablet` / `desktop` tier system — only:

- **default** — anything below `1000px`. This is the base state; write all styles unconditionally.
- **`desktop`** — `@media (min-width: 1000px)` (or the Tailwind `desktop:` variant). Override defaults here when the layout has room to expand.

```css
.varieties-layout {
	display: grid;
	grid-template-columns: 1fr; /* default */
}

@media (min-width: 1000px) {
	.varieties-layout {
		grid-template-columns: 320px 1fr; /* desktop */
	}
}
```

**Don't:**

- Introduce extra breakpoints (`sm`, `md`, `lg`, `tablet`, etc.).
- Write `max-width` queries for "mobile" — write the default rule unconditionally and override for `desktop`.
- Refer to viewport states as "mobile" or "tablet" in code, classes, comments, or docs. Use "default" / "desktop".

## `@utility` Directives (`components.css`)

Shared base styles registered as Tailwind utilities — composable with `@apply` across all CSS files.

### `btn`

Base button: `flex items-center gap-2 px-5 py-2 rounded-lg font-medium cursor-pointer border-none transition-colors`

Extended by color variants:

| Class          | Colors                             |
| -------------- | ---------------------------------- |
| `.btn-primary` | `bg-primary text-white`            |
| `.btn-danger`  | `bg-danger text-white`             |
| `.btn-outline` | `bg-text-muted/15 text-text-muted` |

Size/state modifiers (combine with variants):

| Class            | Effect                                                 |
| ---------------- | ------------------------------------------------------ |
| `.btn-sm`        | `text-xs px-2 py-1`                                    |
| `.btn-start`     | `bg-success text-white` (overrides color)              |
| `.btn-action-sm` | Compact action button with subtle bg (`bg-primary/15`) |

### `sheet-backdrop`

Full-screen fixed overlay: `fixed inset-0 z-50 bg-black/60`

Used by `.bottom-sheet-backdrop` and `.right-sheet-backdrop`.

### `sheet-close`

Absolute-positioned close button (top-right): `absolute top-4 right-4 z-10 w-8 h-8 rounded-full text-text-muted hover:text-text`

Used by `.bottom-sheet-close` and `.right-sheet-close`.

### `sheet-base`

Shared panel base: `fixed z-50 bg-bg-light overflow-y-auto px-6 py-6` + scrollbar styling.

Used by `.bottom-sheet` and `.right-sheet`.

### `status-badge`

Small status pill: `text-xs font-medium px-2 py-0.5 rounded-full border border-current/25 bg-text-muted/20 text-text-muted`

State classes on the element:

| Class         | Colors                             |
| ------------- | ---------------------------------- |
| `.started`    | `bg-primary/20 text-primary`       |
| `.continuous` | `bg-continuous/20 text-continuous` |
| `.recurring`  | `bg-recurring/20 text-recurring`   |
| `.finished`   | `bg-success/20 text-success`       |

## Shared Components (`components.css`)

### Layout

| Class              | Description                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `.app-header`      | Sticky nav bar with `.app-nav`, `.nav-link`, `.logout-btn`            |
| `.container`       | Full-width wrapper with responsive padding (4px default, 10% desktop) |
| `.date-navigation` | Centered date picker bar                                              |

### Buttons

| Class            | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `.btn-primary`   | Primary CTA (blue)                                       |
| `.btn-danger`    | Destructive action (red)                                 |
| `.btn-outline`   | Muted/secondary action                                   |
| `.btn-cancel`    | Small 36px icon button (danger tinted)                   |
| `.btn-sm`        | Size modifier (smaller text + padding)                   |
| `.btn-start`     | Color modifier (success green)                           |
| `.btn-action-sm` | Compact action with subtle bg                            |
| `.btn-icon`      | Icon-only button (transparent bg, muted → text on hover) |

### Inputs

| Class                                                                     | Description                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `.input-transparent`                                                      | Borderless, centered text input                        |
| `.pill-container`                                                         | Compound input with label, divider, time/date sections |
| `.pill-label`, `.pill-divider`, `.pill-time`, `.pill-date`, `.pill-clear` | Pill sub-components                                    |

### Modals & Sheets

| Class                       | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `.modal-backdrop`           | Full-screen overlay with centered content                          |
| `.modal-card`               | Modal content box (rounded, shadowed, scrollable)                  |
| `.modal-title`              | Modal heading (text-2xl bold centered)                             |
| `.bottom-sheet-backdrop`    | Full-screen overlay for bottom sheets (via `sheet-backdrop`)       |
| `.bottom-sheet`             | Slide-up panel (max 60vh, scrollable, via `sheet-base`)            |
| `.bottom-sheet-close`       | Absolute-positioned close button (via `sheet-close`)               |
| `.bottom-sheet-constrained` | Constrains content to max-w-5xl                                    |
| `.right-sheet-backdrop`     | Full-screen overlay for right sheets (via `sheet-backdrop`)        |
| `.right-sheet`              | Slide-in-right panel (420px / 90vw, full height, via `sheet-base`) |
| `.right-sheet-close`        | Absolute-positioned close button (via `sheet-close`)               |

### Toggle Switch

| Class                        | Description                           |
| ---------------------------- | ------------------------------------- |
| `.toggle`                    | Base toggle (w-14 h-8)                |
| `.toggle.toggle-sm`          | Small variant (w-10 h-5)              |
| `.toggle.on` / `.toggle.off` | State classes                         |
| `.knob`                      | Toggle knob (nested inside `.toggle`) |

### Progress Bar

| Class             | Description                            |
| ----------------- | -------------------------------------- |
| `.progress-track` | Bar container (h-2, rounded, muted bg) |
| `.progress-fill`  | Fill bar (primary blue by default)     |

State classes on the parent element:

| Class                  | Fill Color    |
| ---------------------- | ------------- |
| `.met`, `.completed`   | Success green |
| `.exceeded`, `.danger` | Danger red    |
| `.warning`             | Warning amber |

### Notifications

| Class                | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `.floating-reminder` | Fixed top-right note with left border accent                     |
| `.toast-container`   | Fixed top-right toast stack                                      |
| `.toast`             | Individual toast with `.toast-success` / `.toast-error` variants |

### History/Chart

| Class                           | Description                               |
| ------------------------------- | ----------------------------------------- |
| `.history-controls`             | Flex row: frequency toggle + date pickers |
| `.frequency-toggle`             | Segmented button group (D/W/M)            |
| `.history-dates`                | Date input pair                           |
| `.chart-container`              | Chart wrapper (full width, 250px height)  |
| `.history-empty`                | Empty state display                       |
| `.history-loading` / `.spinner` | Loading state                             |

### Miscellaneous

| Class           | Description                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `.status-badge` | Status pill (via `@utility`) with `.started`/`.continuous`/`.recurring`/`.finished` states |
| `.back-link`    | Navigation link with icon + text                                                           |
| `.field-error`  | Validation ring (danger border + ring)                                                     |

### Forms (shared)

| Class                  | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `.detail-form`         | Form container (column flex)                                    |
| `.detail-field`        | Field wrapper (label + input/textarea/select with theme inputs) |
| `.detail-field-header` | Header row inside a field (label + inline action button)        |
| `.detail-actions`      | Form button group (right-aligned)                               |
| `.section-header`      | Section heading row (title + trailing controls)                 |
| `.desc-edit-btn`       | Small pen-icon "edit" toggle next to a label                    |
| `.desc-view`           | Read-only text block (pre-wrap, used with `linkify()`)          |
| `.linkify-link`        | Anchor styling produced by `linkify()` (primary blue underline) |

## Habits (`habits.css`)

| Class               | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `.habit-list`       | Responsive card grid (`auto-fill, minmax(250px, 1fr)`)          |
| `.habit-card`       | Card container with hover effect                                |
| `.habit-header`     | Title row (name + flag + badge)                                 |
| `.title`            | Habit name                                                      |
| `.required-flag`    | Warning-colored flag icon                                       |
| `.frequency-badge`  | Purple pill for non-daily habits (same shape as `status-badge`) |
| `.description`      | Truncated description (2 lines)                                 |
| `.value-controls`   | +/- buttons + number input                                      |
| `.adjust-btn`       | Round increment/decrement button                                |
| `.value-input`      | Number input wrapper                                            |
| `.progress-section` | Progress bar + text                                             |
| `.period-value`     | Accumulated period value label                                  |
| `.streaks`          | Streak display (fire + trophy icons)                            |
| `.history-btn`      | Chart icon button (top-right corner of card)                    |

## Tasks (`tasks.css`)

### Timer Panel

| Class               | Description                                      |
| ------------------- | ------------------------------------------------ |
| `.task-timer-panel` | Main timer container                             |
| `.task-header`      | Timer header row                                 |
| `.task-selector`    | Task dropdown (`.active` when task selected)     |
| `.comment-toggle`   | Comment icon button (`.has-comment` when filled) |
| `.comment-input`    | Comment text field                               |
| `.timer-row`        | Row with time entries + controls                 |
| `.time-entries`     | Time picker group                                |
| `.timer-controls`   | Start/stop buttons                               |
| `.timer-display`    | Large monospace time (`.clickable` variant)      |
| `.time-summary`     | Daily/weekly progress bars                       |
| `.summary-item`     | Single summary (label + bar + value)             |
| `.summary-actions`  | Action buttons below summary                     |
| `.summary-pace`     | Pace/target text                                 |
| `.running`          | Red override for stop button                     |

### Task Lists

| Class              | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `.tasks-content`   | 2-column grid (1 below desktop)                                                            |
| `.tasks-section`   | Section card with heading                                                                  |
| `.section-header`  | Section title + create button                                                              |
| `.task-list`       | Vertical list container                                                                    |
| `.task-item`       | Single task row                                                                            |
| `.task-info`       | Task name + project + description                                                          |
| `.task-meta`       | Status + due date + time badges                                                            |
| `.task-actions`    | Action buttons group                                                                       |
| `.show-more-btn`   | Expandable list divider (line-pill-line)                                                   |
| `.priority-filter` | Pill group for filtering by priority (in `.section-header`) — buttons take `.active` state |
| `.priority-badge`  | `P{n}` pill next to `.status-badge` — `.p-1` danger, `.p-2` warning, muted otherwise       |

### Tree View

| Class                   | Description                              |
| ----------------------- | ---------------------------------------- |
| `.tree-project-wrapper` | Project node with action buttons         |
| `.tree-project-row`     | Project row layout                       |
| `.tree-chevron-btn`     | Expand/collapse button                   |
| `.tree-chevron`         | Chevron icon (`.expanded` rotates 90deg) |
| `.tree-folder-icon`     | Folder icon (primary color)              |
| `.tree-project-name`    | Project name                             |
| `.tree-project-due`     | Due date label                           |
| `.tree-children`        | Nested children (left border accent)     |
| `.task-name-btn`        | Clickable task/project name              |

### Forms

`.detail-form` / `.detail-field` / `.detail-actions` are defined in `components.css` (shared). The classes below are tasks-specific.

| Class                                                             | Description                 |
| ----------------------------------------------------------------- | --------------------------- |
| `.detail-inline-row`                                              | Horizontal field layout     |
| `.detail-info-row`                                                | Read-only info display      |
| `.detail-info-item` / `.detail-info-label` / `.detail-info-value` | Info item parts             |
| `.detail-title-row`                                               | Title row with project link |

### Todos

| Class        | Description               |
| ------------ | ------------------------- |
| `.todo-list` | Todo list container       |
| `.todo-item` | Todo with custom checkbox |
| `.todo-add`  | Add todo input row        |

### Project Page

| Class                                      | Description                |
| ------------------------------------------ | -------------------------- |
| `.project-nav`                             | Back links row             |
| `.project-detail-card`                     | Project info card          |
| `.project-children-section`                | Children list card         |
| `.project-children-header`                 | Header with create buttons |
| `.project-children-list`                   | Children list              |
| `.project-child-row`                       | Single child row           |
| `.child-name`, `.child-due`, `.child-time` | Child info parts           |
| `.child-chevron`, `.child-task-icon`       | Child row icons            |

### Dependencies

| Class                 | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `.task-name-row`      | Flex baseline row wrapping task name + blocked icon        |
| `.blocked-icon`       | Muted ban icon shown inline for blocked tasks              |
| `.dep-badges`         | Flex-wrap row of dependency badge pills                    |
| `.dep-badge`          | Clickable dependency pill (secondary purple, rounded-full) |
| `.dep-selected-pills` | Flex-wrap row of selected pills in DepSelector             |
| `.dep-pill`           | Selected dependency pill with remove button                |
| `.dep-pill-remove`    | Remove (✕) button inside dep-pill                          |

### Agenda Right Sheet

| Class                    | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `.agenda-title`          | Sheet heading (lg bold, right padding for close btn)                     |
| `.agenda-subtitle-row`   | Flex row: subtitle text + mode toggle                                    |
| `.agenda-subtitle`       | Muted subtitle text                                                      |
| `.agenda-mode-toggle`    | Day/week toggle button (inline with subtitle)                            |
| `.agenda-timeline`       | Vertical timeline container                                              |
| `.agenda-row`            | Flex row: hour label + entry/gap                                         |
| `.agenda-hour-label`     | Monospace hour label (bottom-aligned, 40px)                              |
| `.agenda-day-divider`    | Day boundary divider (line—label—line), also used in "Próximas a vencer" |
| `.agenda-day-line`       | Horizontal line in day divider                                           |
| `.agenda-day-label`      | Uppercase date label (e.g. "Miércoles 8/4")                              |
| `.agenda-gap`            | Idle gap indicator (line—duration—line)                                  |
| `.agenda-gap-line`       | Horizontal line in gap                                                   |
| `.agenda-gap-label`      | Muted mono duration text in gap                                          |
| `.agenda-entry`          | Clickable entry row (bar + content)                                      |
| `.agenda-entry-bar`      | Colored left bar (`.finished` green, `.running` pulse)                   |
| `.agenda-entry-content`  | Name + project + meta                                                    |
| `.agenda-entry-name`     | Task name (semibold, truncated)                                          |
| `.agenda-entry-project`  | Project name (muted, truncated)                                          |
| `.agenda-entry-row`      | Time + status badge + duration row                                       |
| `.agenda-entry-time`     | Monospace time range                                                     |
| `.agenda-entry-duration` | Right-aligned duration                                                   |

### Create Sheet

| Class                 | Description                      |
| --------------------- | -------------------------------- |
| `.create-mode-toggle` | Tarea/Proyecto segmented control |
| `.start-now-toggle`   | "Empezar ya" button with toggle  |

## Varieties (`varieties.css`)

Reuses `.section-header` / `.detail-field` / `.detail-field-header` / `.desc-edit-btn` / `.desc-view` / `.linkify-link` / `.btn-icon` from `components.css`. Only layout and distinctive visual classes live here.

| Class               | Description                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.varieties-layout` | Outer grid: 1 column default, `320px 1fr` at desktop                                                                                      |
| `.ranking-list`     | Left column surface card holding the ranking                                                                                              |
| `.ranking-row`      | Clickable rank row (`<button>`) — rank + name + score + price; `.podium` for #1; clicking scrolls/highlights the matching `.variety-card` |
| `.variety-card`     | Single variety card; `.saving` border during a pending PUT, `.highlight` flash when targeted from the ranking                             |
| `.score-badge`      | Computed puntuación pill (primary blue)                                                                                                   |
| `.score-grid`       | 2×2 grid; nested rules tighten the four `.detail-field` score inputs (centered, mono, smaller padding)                                    |
| `.comments-empty`   | Dashed placeholder button shown when comments are empty                                                                                   |

## Login (`login.css`)

| Class                   | Description                                   |
| ----------------------- | --------------------------------------------- |
| `.login-container`      | Centered full-screen wrapper                  |
| `.login-container form` | Card with border + shadow                     |
| `.form-group`           | Input wrapper with spacing                    |
| `.error-message`        | Red error banner                              |
| `.subtitle`             | Muted subtitle text                           |
| `.back-link`            | Centered variant (adds `justify-center mt-4`) |

## Animations

Defined in `components.css`:

| Keyframe                 | Duration              | Usage              |
| ------------------------ | --------------------- | ------------------ |
| `fade-in`                | 150ms ease-out        | Modal backdrop     |
| `scale-in`               | 150ms ease-out        | Modal card         |
| `slide-up`               | 200ms cubic-bezier    | Bottom sheet open  |
| `slide-down`             | 150ms ease-in         | Bottom sheet close |
| `slide-in-right`         | 200ms cubic-bezier    | Right sheet open   |
| `slide-out-right`        | 150ms ease-in         | Right sheet close  |
| `slide-in-right` (toast) | 200ms ease-out        | Toast notification |
| `spin`                   | 600ms linear infinite | Loading spinner    |
