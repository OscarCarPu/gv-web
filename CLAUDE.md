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

Login (password) returns `{ token, kind: 'tmp' | 'semi' }` (`LoginResponseSchema`). `kind: 'tmp'` → continue to 2FA (TOTP) → full JWT stored as httpOnly cookie (`session`), exposed as `event.locals.token`. `kind: 'semi'` → token stored as httpOnly cookie (`semiprivate`), exposed as `event.locals.semiprivateToken`, redirect to `/varieties`.

`hooks.server.ts` validates both JWTs on every request and guards routes by tier:

- **Public** (`PUBLIC_ROUTES`): `/login`, `/login/2fa` — accessible without auth; redirect to `/habits` if `session` valid, to `/varieties` if `semiprivate` valid.
- **Semiprivate** (`SEMIPRIVATE_ROUTES`): `/varieties` — accessible with either `session` or `semiprivate`.
- **Auth-only** (`AUTH_ONLY_ROUTES`): `/logout` — passes through regardless of auth state; the action clears both cookies.
- **Private** (everything else): requires valid `session`.

### Styling System

Tailwind CSS 4 via Vite plugin — config lives in `src/styles/app.css` using `@theme` directive (no tailwind.config.js). Single breakpoint: `desktop` at 1000px. Feature CSS files use `@reference "./app.css"` for theme tokens. Shared base utilities (`btn`, `status-badge`, `sheet-backdrop`, `sheet-close`, `sheet-base`) are defined via `@utility` in `components.css`. See [docs/styling.md](docs/styling.md) for tokens and class inventory.

### Path Aliases

- `$shared` → `src/lib/shared`
- `$habits` → `src/lib/domains/habits`
- `$auth` → `src/lib/domains/auth`
- `$styles` → `src/styles`

### Data Visualization

Charts use LayerCake + D3 scale. Components in `src/lib/shared/components/chart/` (Area, Line, Points, AxisX, AxisY).

## Key Patterns

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect` — not legacy `$:` or stores
- **Zod validation**: Every API response has a schema in `{domain}/api/*.schemas.ts` — always validate. Use `.nullable().transform(v => v ?? [])` for array fields the API may return as `null`
- **CSS convention**: Styles go in global CSS files (`src/styles/`), not scoped `<style>` blocks. Reuse existing classes before creating new ones. Never hardcode `rgba()` for borders — use `--color-border` / `--color-border-light`. See [docs/styling.md](docs/styling.md) for the class inventory
- **Spanish UI**: All user-facing text is in Spanish
- **No confirmation dialogs**: Destructive actions (delete task/project/todo) execute immediately — no modals
- **List folding**: Long lists fold at 15 items with a "show more" divider (`.show-more-btn`, line—pill—line pattern) that expands 10 at a time
- **Datetime convention**: `due_at` is a conceptual date, not a UTC moment. Use `toISOString()` from `$shared/utils/datetime.ts` (compensates tz offset to avoid day-shift), `toLocalDatetime()` to slice ISO for inputs, and `toLocalDateString()` to extract local `YYYY-MM-DD` from a `Date`. Time entries (`started_at` / `finished_at`) use native `new Date().toISOString()` for real UTC moments
- **Linkified descriptions**: Render task/project descriptions via `linkify()` from `$shared/utils/linkify.ts`; the root layout installs `installLinkifyHandler()` for `file://` clipboard-copy fallback
- **Env vars**: `VITE_API_URL` (browser), `API_URL` (server/Docker), `ORIGIN` (CSRF)

## Tasks domain — quick rules

Full detail in [docs/tasks.md](docs/tasks.md). Non-obvious rules to remember while coding:

- **Dependencies**: `depends_on` / `blocks` are `TaskDepRef[]` on responses; API only accepts `depends_on: number[]` on create/update (omit = unchanged, `[]` = clear). Editing `blocks` requires fetching + updating each affected task individually. `blocked: true` disables action buttons and shows `.blocked-icon`
- **Task types**: `standard` / `continuous` / `recurring`. Recurring requires `recurrence: number` (days). In "Próximas a vencer" + "Proyectos activos", recurring tasks show "Renovar" (reschedules `due_at = today + recurrence`) instead of "Acabar". Everywhere else, Finalizar sets `finished_at` normally. Use `getStatusLabel()` for badges
- **Priority**: 1 (highest) to 5 (lowest), default `3`. Create omits when default (consistent with `task_type`); update always sends. Client-side priority filter on `/tasks` sections — projects in the tree are always kept regardless of children's priorities
- **Overdue**: `TaskItem` applies `.overdue` class (red) when `due_at < today` on "Próximas a vencer"

## Deployment

Push to `main` triggers Gitea Actions deploy (Docker). Active development on `develop` branch, merge to `main` to deploy.
