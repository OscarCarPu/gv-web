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
src/lib/domains/{auth,habits,tasks,money}/
  api/       — API methods + Zod response schemas
  types/     — TypeScript interfaces and request types
  components/ — Domain-specific Svelte components
  utils/     — Domain helpers (e.g. money/utils/categoryTree.ts)
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

## Money domain — quick rules

Route: `/money` (private). API base: `/finance/*`. Visible label: "Dinero" (Spanish UI), but the URL, folder (`src/lib/domains/money/`), styles (`src/styles/money.css`), and `moneyApi` follow the English-URL convention used by `/tasks`, `/habits`, `/varieties`.

- **Money values are strings**: every monetary field (`total`, `amount`, `accounts_total`, `month.income/expense/balance`) is `NUMERIC(15,2)` serialized as a JSON string. Keep them as strings end-to-end and only `parseFloat` at format time. Use `formatMoney()` from `$shared/utils/money.ts` (`Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' })` → `1.234,56 €`). There is no per-account currency — the API removed it; everything is EUR
- **Transaction types**: `income` / `expense` / `transfer`. The transaction's category `type` MUST match the transaction's `type` (server enforces). The form filters category options client-side by selected type and resets `category_id` when the type changes
- **Transfers**: `to_account_id` is required iff `type === 'transfer'`, must differ from `account_id`, and must be `null` for income/expense. Hide the destination select unless the type is transfer
- **`occurred_at`**: optional on `POST` (server defaults to `now()`), but **required on `PUT`** — always send it from update flows. Use `toISOString()` / `toLocalDatetime()` from `$shared/utils/datetime.ts` exactly like task `due_at`
- **Account totals are server-maintained**: a Postgres trigger updates `accounts.total` on every transaction insert/update/delete. After any transaction mutation call `invalidateAll()` so the SSR loader refetches `/finance/overview` and account totals reflect the new state
- **Delete conflicts (409)**: `DELETE /finance/accounts/:id` and `DELETE /finance/categories/:id` return `409` when referenced by transactions or other categories. Catch the error message (`includes('transactions')` / `includes('referenced')`) and surface a Spanish toast — don't show a confirmation dialog
- **Category tree**: categories are flat (`parent_id` self-FK). Use `buildCategoryOptions()` from `$lib/domains/money/utils/categoryTree.ts` to flatten into a depth-first list with NBSP-indented `label`s for `<select>` options. The category form's parent picker also walks descendants and excludes them to prevent cycles. The Categorías card renders a real expandable tree via `CategoryTreeNode` using the existing `.tree-project-row` / `.tree-children` / `.tree-chevron-btn` classes from `tasks.css`
- **CSS reuse**: `/money` reuses `.tasks-section`, `.task-list`, `.task-item`, `.show-more-btn`, `.tree-*`, `.agenda-day-divider/line/label` from `tasks.css`. The `/money/+layout.svelte` imports both `tasks.css` and `money.css` — root layout does NOT import them. Money-specific additions in `money.css` only: `.money-content` (desktop:`grid-cols-[2fr_1fr]`, mobile single column), `.money-side` (right column with stacked accounts+categories), `.money-tiles` / `.money-tile` (single-row KPI tiles), `.money-tx-row` / `.money-tx-info` / `.money-tx-category` (single-line transaction rows), `.money-type-toggle` (income→success / expense→danger / transfer→primary color overrides on the segmented control), `.amount-positive` / `.amount-negative` / `.amount-neutral`. Also added `.status-badge.expense` modifier in `components.css`
- **Recent transactions**: `/finance/overview.recent_transactions` returns the last 30 days. The list folds at 15 with the standard show-more pattern and is grouped by day using `.agenda-day-divider` (today's group highlighted), reusing the tasks "Próximas a vencer" pattern
- **Overview tiles & MoM change**: `/finance/overview` returns both `month` and `previous_month` (same shape: `income` / `expense` / `balance`). `OverviewCard` renders 6 tiles — Total / Ingresos / Gastos / Balance / **Ahorro** (`balance / income * 100`) / **% vs mes anterior** (`(balance − prev.balance) / |prev.balance| * 100`, "—" when prev is `0`). All client-derived; no extra request

### Stats sheets — four BottomSheets opened from the OverviewCard header

The Resumen header has four `btn-icon` buttons left of "+ Movimiento":

- `chart-line` → **NetWorthSheet** (Evolución del patrimonio): line+area via LayerCake. Range toggle `3M / 6M / 1A / YTD / Todo` shared with MonthlyTrendSheet (CSS class `.create-mode-toggle.sheet-range-toggle`). 4 KPI tiles: Actual / Cambio / % Cambio / Máximo. **Hover** = vertical guide + dot + HTML tooltip with formatted date and value, implemented as `NetWorthHoverLayer.svelte` inside `<Svg>` reading `getContext('LayerCake')`. Granularity is derived: `3M`/`6M` → `week`, `1A`/`YTD`/`Todo` → `month`
- `chart-pie` → **CategoryBreakdownSheet** (Por categoría · este mes): toggle Gastos / Ingresos / Transferencias (`.create-mode-toggle.money-type-toggle`). 2 KPI tiles: Total / Movimientos. Tree rendered as a flat indented list with `--cat-depth` CSS variable; chevron expands children. Bar colors switch via `.cat-tree-income .cat-tree-fill` / `.cat-tree-transfer .cat-tree-fill` overrides on the parent `<ul>`
- `chart-column` → **MonthlyTrendSheet** (Ingresos vs gastos por mes): hand-rolled SVG (no LayerCake) with `bind:clientWidth` for crisp text — never use `viewBox` + `preserveAspectRatio="none"` for charts that contain text, it stretches glyphs. Two grouped bars per month (success / danger) plus tendency polylines connecting bar tops. Account selector uses a hidden `<span class="select-fit-mirror">` to size the native `<select>` to its selected option + arrow padding. Hover tooltip is positioned near the cursor (`tooltipLeft = clamp(centerX − 100, 4, containerWidth − 204)`), not pinned to a corner
- `arrow-trend-up` → **EstimationSheet** (Estimación del patrimonio): LayerCake line+area like NetWorthSheet, but the path is split into a **solid actual segment** and a **dashed projected segment** sharing a bridge point, rendered by `EstimationPaths.svelte`. Controls (mode toggle + `<input type="month">` start/end) all live in one `.sheet-controls-row` that reuses `.sheet-range-toggle` and `.sheet-account-filter` (the latter's CSS now targets both `select` and `input`). Modes: `rate` (Tasa %/mes — compound monthly rate `(last/first)^(1/n) − 1`) and `saving` (Ahorro €/mes — average monthly delta `(last − first)/n`). **The projection factor is derived server-side from the historical actuals; it is not a user input.** 4 KPI tiles: Actual / Tasa or Ahorro mensual / Estimado final / % Cambio. Backend response is the object `{ points, rate, saving }`, not a bare array — `EstimationResultSchema` reflects that

### Stats sheets — shared patterns

- **Date ranges**: `3M` / `6M` / `1A` are inclusive month boundaries — `3M` from today _15 abril_ means the **first day of `month − 2`** (so 1 feb), not 90 days ago. `YTD` = 1 enero year actual. `Todo` omits `from` so the backend defaults to the earliest transaction date. Build the start date as `new Date(y, m - (N - 1), 1)`
- **Anti-flicker on filter change**: each sheet uses `let initialLoading = $state(true)` (NOT `loading`). The spinner only shows on the very first fetch; subsequent refetches keep the previous chart rendered until the new data arrives. Reset `initialLoading = true` and `data = []` in the `else` branch of the open `$effect` so reopening starts from a clean slate
- **API fallbacks for SSR errors**: when extending `Overview` (or any other server-loaded shape) update _both_ the Zod schema in `api/money.schemas.ts` _and_ the catch fallback in `routes/money/+page.server.ts` — otherwise SSR breaks when the API is down

### Stats charts — implementation files

```
src/lib/domains/money/components/
  NetWorthSheet.svelte         CategoryBreakdownSheet.svelte    MonthlyTrendSheet.svelte
  charts/
    NetWorthChart.svelte       — LayerCake Area+Line with hover overlay
    NetWorthHoverLayer.svelte  — getContext('LayerCake'), emits hover info up
    AxisYMoney.svelte          — money-aware Y axis (1k/10k/etc shorthand)
    IncomeExpenseBars.svelte   — pure SVG, bind:clientWidth, polylines + tooltip
    CategoryBars.svelte        — horizontal bars (CSS widths, no SVG)
```

Backend endpoints: `GET /finance/stats/networth`, `/by-category`, `/monthly`. Date ranges follow the rule "missing `from` → earliest transaction date" so omitting `from` is the canonical way to request "All time" data — don't send a sentinel like `2000-01-01`

## Deployment

Push to `main` triggers Gitea Actions deploy (Docker). Active development on `develop` branch, merge to `main` to deploy.
