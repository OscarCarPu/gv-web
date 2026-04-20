# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev              # Start dev server
bun run build            # Production build
bun run check            # Type-check (svelte-kit sync + svelte-check)
bun run lint             # Prettier + ESLint check
bun run format           # Auto-format with Prettier
bun run test:unit        # Unit tests (Vitest, watch mode)
bun run test:unit -- --run  # Unit tests (single run)
bun run test             # All tests (unit --run)
make up-dev              # Dev: clears .svelte-kit, syncs, starts dev server
```

## Architecture

SvelteKit 2 + Svelte 5 (runes API) personal productivity app with habit tracking and task/time management. SSR via adapter-node, deployed with Docker.

### Domain-Driven Structure

```
src/lib/domains/{auth,habits,tasks}/
  api/       — API methods + Zod response schemas
  types/     — TypeScript interfaces and request types
  components/ — Domain-specific Svelte components
src/lib/shared/
  api/client.ts   — fetchAPI<T>(endpoint, schema, options?) core HTTP client
  components/     — Reusable UI (BottomSheet, RightSheet, Modal, DatetimePicker, chart/*)
  stores/         — toast.svelte.ts (Svelte 5 runes store)
  utils/          — datetime helpers, date navigation runes
```

### API Layer

All API calls go through `fetchAPI<T>()` which validates responses against Zod schemas. Token management: `setClientToken()` on client, `event.locals.token` on server (from httpOnly cookie). The base URL resolves to `VITE_API_URL` in browser, `API_URL` on server.

### Auth Flow

Login (password) → optional 2FA (TOTP) → JWT stored as httpOnly cookie (`session`). `hooks.server.ts` validates JWT on every request and guards routes. Public routes: `/login`, `/login/2fa`.

### Styling System

Tailwind CSS 4 via Vite plugin — config lives in `src/styles/app.css` using `@theme` directive (no tailwind.config.js). Single custom breakpoint: `desktop` at 1000px (default sm/md/lg/xl/2xl disabled). Feature CSS files use `@reference "./app.css"` to access theme tokens. Font: Inter (body), JetBrains Mono (monospace). All component styles use `@apply` in global CSS files — only use scoped `<style>` blocks as a last resort.

Shared base utilities are defined via `@utility` in `components.css` (e.g. `btn`, `status-badge`, `sheet-backdrop`, `sheet-close`, `sheet-base`) so they can be composed with `@apply` across files. Border colors use theme tokens `--color-border` / `--color-border-light` — never hardcode `rgba()` for borders.

### Path Aliases

- `$shared` → `src/lib/shared`
- `$habits` → `src/lib/domains/habits`
- `$auth` → `src/lib/domains/auth`
- `$styles` → `src/styles`

### Data Visualization

Charts use LayerCake + D3 scale. Components in `src/lib/shared/components/chart/` (Area, Line, Points, AxisX, AxisY).

## Key Patterns

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect` — not legacy `$:` or stores
- **Zod validation**: Every API response has a schema in `{domain}/api/*.schemas.ts` — always validate
- **CSS convention**: Styles go in global CSS files (`src/styles/`), not in component `<style>` blocks. Use existing classes from components.css/tasks.css/habits.css before creating new ones. See `docs/styling.md` for the full class inventory
- **Spanish UI**: All user-facing text is in Spanish
- **Task dependencies**: Tasks can depend on other tasks. `depends_on` (tasks this depends on) and `blocks` (tasks this blocks) are `TaskDepRef[]` (`{id, name, due_at}`) on all task responses. `blocked: boolean` indicates whether the task has unfinished dependencies. API accepts `depends_on: number[]` on create/update. Zod schemas use `.nullable().transform(v => v ?? [])` since API may return null. Editing reverse deps (`blocks`) requires fetching+updating each affected task individually. Blocked tasks show a `fa-ban` icon inline with the task name (`.blocked-icon` class) and have all action buttons (Empezar/Acabar, Asignar/Iniciar) disabled.
- **Task types**: `task_type` field on all task responses: `"standard"` (default), `"continuous"`, `"recurring"`. Recurring tasks also have `recurrence: number` (days between occurrences; `omitempty` — absent/undefined for non-recurring). Status badge labels when started: standard → "En progreso", continuous → "Continua", recurring → "Recurrente · Cada N días" (agenda uses shorter "Recurrente · N"). Helper: `getStatusLabel()` in `src/lib/domains/tasks/utils/statusLabel.ts`. Each type has a dedicated theme color and CSS class on `.status-badge`: `.started` (blue/primary), `.continuous` (teal/`--color-continuous`), `.recurring` (amber/`--color-recurring`). Status labels are shown in all views: TaskItem, TreeNodeItem, project detail children, and agenda entries. In "Próximas a vencer" and "Proyectos activos", recurring tasks show "Renovar" instead of "Acabar" — this reschedules (`due_at = today + recurrence`) instead of finishing. In all other views (TaskBottomSheet, project detail), "Finalizar"/"Acabar" sets `finished_at` normally. Task type and recurrence are editable: CreateBottomSheet has Tipo/Cada fields on the same row as Fecha límite and Proyecto; TaskBottomSheet has them on the same row as Nombre and Fecha límite. The "Cada (días)" input only appears when Recurrente is selected.
- **Task priority**: `priority` field on all task responses. Integer 1 (highest/most urgent) to 5 (lowest), default `3`. API accepts `priority?: number` on create/update (`POST`/`PATCH /tasks/tasks`). `ActiveTreeNode` and `ProjectChildNode` type it as optional (`omitempty` on the API). Editable via a Prioridad `<select>` in both CreateBottomSheet and TaskBottomSheet, placed in the same inline row as Tipo. Rendered as a `.priority-badge` (with `.p-1` danger / `.p-2` warning / muted for 3-5) next to `.status-badge` on TaskItem and TreeNodeItem. On `/tasks`, "Próximas a vencer" and "Proyectos activos" each have a `.priority-filter` pill group ("Todas · ≤1 · ≤2 · ≤3 · ≤4") that filters client-side by `priority <= N` — projects in the tree are always kept even when their children are filtered out (matches the API's `min_priority` semantics on `/tasks/tree`). Server-side `min_priority` query param exists on `/tasks/tree` and `/tasks/tasks/by-due-date` but is not used from the frontend (filter is client-side since data is loaded SSR in full).
- **No confirmation dialogs**: Destructive actions (delete task, delete project, delete todo) execute immediately without confirmation modals
- **List folding**: Long lists fold at 15 items with a "show more" divider (line—pill—line pattern, `.show-more-btn`) that expands 10 at a time. See "Próximas a vencer" in `/tasks` for reference
- **Datetime convention**: `due_at` is a conceptual date, not a UTC moment. `toISOString()` compensates for timezone offset so the ISO string preserves the local date/time (avoids day-shift). `toLocalDatetime()` slices the ISO string directly (no tz conversion). `toLocalDateString()` extracts the local `YYYY-MM-DD` from a Date object (avoids UTC day-shift from `.toISOString().split('T')[0]`). Time entries (`started_at`, `finished_at`) use native `new Date().toISOString()` for real UTC moments.
- **Env vars**: `VITE_API_URL` (browser), `API_URL` (server/Docker), `ORIGIN` (CSRF)

## Deployment

Push to `main` triggers Gitea Actions deploy (Docker). Active development on `develop` branch, merge to `main` to deploy.
