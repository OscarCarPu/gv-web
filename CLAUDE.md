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

## Testing in a browser

Always use **Librewolf** to manually test/verify this project in a browser (not Chromium/Chrome). UI behavior can differ in Librewolf (Firefox-based, `resistFingerprinting` on by default), and that is the target browser. The dev server runs at `localhost:5173`.

To drive Librewolf programmatically use **`scripts/librewolf_drive.py`** — a stdlib-only Marionette (WebDriver) client that controls the real Librewolf binary (no geckodriver/Selenium/Playwright needed; Librewolf ships Marionette built in). It auto-authenticates by minting a full JWT (same flow as `make auth` in `../gv-api`: password + TOTP, needs `pyotp`) and injecting it as the `session` httpOnly cookie, skipping the login UI.

```bash
python scripts/librewolf_drive.py /tasks         # smoke test: open path + screenshot
GV_HEADFUL=1 python scripts/librewolf_drive.py   # watch the browser (non-headless)
```

```python
from librewolf_drive import Session            # run from scripts/ (or add it to sys.path)
with Session() as m:                            # launches Librewolf, logs in via cookie
    m.goto("/tasks")
    m.wait("#dtp-task-due"); m.click(m.find("#dtp-task-due"))
    m.screenshot("/tmp/shot.png")
```

Requires `librewolf` on PATH, the dev server on :5173, and `gv-api` reachable.

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
- **Semiprivate** (`SEMIPRIVATE_ROUTES`): `/varieties`, `/printers` — accessible with either `session` or `semiprivate`.
- **Auth-only** (`AUTH_ONLY_ROUTES`): `/logout` — passes through regardless of auth state; the action clears both cookies and redirects to `/`.
- **Open** (`OPEN_ROUTES`): `/` — if `session` valid, redirects to `/tasks`; if `semiprivate` valid, redirects to `/varieties`; otherwise passes through (unauthenticated landing page).
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
- **English UI**: All user-facing text is in English
- **No confirmation dialogs**: Destructive actions (delete task/project/todo) execute immediately — no modals
- **List folding**: Long lists fold at 15 items with a "show more" divider (`.show-more-btn`, line—pill—line pattern) that expands 10 at a time
- **Datetime convention**: `due_at` is a conceptual date, not a UTC moment. Use `toISOString()` from `$shared/utils/datetime.ts` (compensates tz offset to avoid day-shift), `toLocalDatetime()` to slice ISO for inputs, and `toLocalDateString()` to extract local `YYYY-MM-DD` from a `Date`. Time entries (`started_at` / `finished_at`) use native `new Date().toISOString()` for real UTC moments
- **Linkified descriptions**: Render task/project descriptions via `linkify()` from `$shared/utils/linkify.ts`; the root layout installs `installLinkifyHandler()` for `file://` clipboard-copy fallback
- **Env vars**: `VITE_API_URL` (browser), `API_URL` (server/Docker), `ORIGIN` (CSRF)

## Tasks domain — quick rules

Full detail in [docs/tasks.md](docs/tasks.md). Non-obvious rules to remember while coding:

- **Dependencies**: `depends_on` / `blocks` are `TaskDepRef[]` on responses; API only accepts `depends_on: number[]` on create/update (omit = unchanged, `[]` = clear). Editing `blocks` requires fetching + updating each affected task individually. `blocked: true` disables action buttons and shows `.blocked-icon`
- **Task types**: `standard` / `continuous` / `recurring`. Recurring requires `recurrence: number` (days). In "Due Soon" + "Active Projects", recurring tasks show "Renew" (reschedules `due_at = today + recurrence`) instead of "Done". Everywhere else, Finish sets `finished_at` normally. Use `getStatusLabel()` for badges
- **Priority**: 1 (highest) to 5 (lowest), default `3`. Create omits when default (consistent with `task_type`); update always sends. Client-side priority filter on `/tasks` sections — projects in the tree are always kept regardless of children's priorities
- **Overdue**: `TaskItem` applies `.overdue` class (red) when `due_at < today` on "Due Soon"

## Money domain — quick rules

Route: `/money` (private). API base: `/finance/*`. Visible label: "Money", URL, folder (`src/lib/domains/money/`), styles (`src/styles/money.css`), and `moneyApi` follow the English-URL convention used by `/tasks`, `/habits`, `/varieties`.

- **Money values are strings**: every monetary field (`total`, `amount`, `accounts_total`, `month.income/expense/balance`) is `NUMERIC(15,2)` serialized as a JSON string. Keep them as strings end-to-end and only `parseFloat` at format time. Use `formatMoney()` from `$shared/utils/money.ts` (`Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' })` → `1.234,56 €`). There is no per-account currency — the API removed it; everything is EUR
- **Transaction types**: `income` / `expense` / `transfer`. The transaction's category `type` MUST match the transaction's `type` (server enforces). The form filters category options client-side by selected type and resets `category_id` when the type changes
- **Transfers**: `to_account_id` is required iff `type === 'transfer'`, must differ from `account_id`, and must be `null` for income/expense. Hide the destination select unless the type is transfer
- **`occurred_at`**: optional on `POST` (server defaults to `now()`), but **required on `PUT`** — always send it from update flows. Use `toISOString()` / `toLocalDatetime()` from `$shared/utils/datetime.ts` exactly like task `due_at`
- **Account totals are server-maintained**: a Postgres trigger updates `accounts.total` on every transaction insert/update/delete. After any transaction mutation call `invalidateAll()` so the SSR loader refetches `/finance/overview` and account totals reflect the new state
- **Delete conflicts (409)**: `DELETE /finance/accounts/:id` and `DELETE /finance/categories/:id` return `409` when referenced by transactions or other categories. Catch the error message (`includes('transactions')` / `includes('referenced')`) and surface an English toast — don't show a confirmation dialog
- **Category tree**: categories are flat (`parent_id` self-FK). Use `buildCategoryOptions()` from `$lib/domains/money/utils/categoryTree.ts` to flatten into a depth-first list with NBSP-indented `label`s for `<select>` options. The category form's parent picker also walks descendants and excludes them to prevent cycles. The Categories card renders a real expandable tree via `CategoryTreeNode` using the existing `.tree-project-row` / `.tree-children` / `.tree-chevron-btn` classes from `tasks.css`
- **CSS reuse**: `/money` reuses `.tasks-section`, `.task-list`, `.task-item`, `.show-more-btn`, `.tree-*`, `.agenda-day-divider/line/label` from `tasks.css`. The `/money/+layout.svelte` imports both `tasks.css` and `money.css` — root layout does NOT import them. Money-specific additions in `money.css` only: `.money-content` (desktop:`grid-cols-[2fr_1fr]`, mobile single column), `.money-side` (right column with stacked accounts+categories), `.money-tiles` / `.money-tile` (single-row KPI tiles), `.money-tx-row` / `.money-tx-info` / `.money-tx-category` (single-line transaction rows), `.money-type-toggle` (income→success / expense→danger / transfer→primary color overrides on the segmented control), `.amount-positive` / `.amount-negative` / `.amount-neutral`. Also added `.status-badge.expense` modifier in `components.css`
- **Recent transactions**: `/finance/overview.recent_transactions` returns the last 30 days. The list folds at 15 with the standard show-more pattern and is grouped by day using `.agenda-day-divider` (today's group highlighted), reusing the tasks "Due Soon" pattern
- **Overview tiles & MoM change**: `/finance/overview` returns both `month` and `previous_month` (same shape: `income` / `expense` / `balance`). `OverviewCard` renders 6 tiles — Total accounts / Monthly income / Monthly expenses / Monthly balance / **Savings** (`balance / income * 100`) / **% vs prev month** (`(balance − prev.balance) / |prev.balance| * 100`, "—" when prev is `0`). All client-derived; no extra request

### Stats sheets — four BottomSheets opened from the OverviewCard header

The Summary header has four `btn-icon` buttons left of "+ Transaction":

- `chart-line` → **NetWorthSheet** (Net worth evolution): line+area via LayerCake. Range toggle `3M / 6M / 1Y / YTD / All` shared with MonthlyTrendSheet (CSS class `.create-mode-toggle.sheet-range-toggle`). 4 KPI tiles: Current / Change / % Change / Maximum. **Hover** = vertical guide + dot + HTML tooltip with formatted date and value, implemented as `NetWorthHoverLayer.svelte` inside `<Svg>` reading `getContext('LayerCake')`. Granularity is derived: `3M`/`6M` → `week`, `1Y`/`YTD`/`All` → `month`
- `chart-pie` → **CategoryBreakdownSheet** (By category · this month): toggle Expenses / Income / Transfers (`.create-mode-toggle.money-type-toggle`). 2 KPI tiles: Total / Transactions. Tree rendered as a flat indented list with `--cat-depth` CSS variable; chevron expands children. Bar colors switch via `.cat-tree-income .cat-tree-fill` / `.cat-tree-transfer .cat-tree-fill` overrides on the parent `<ul>`
- `chart-column` → **MonthlyTrendSheet** (Income vs expenses per month): hand-rolled SVG (no LayerCake) with `bind:clientWidth` for crisp text — never use `viewBox` + `preserveAspectRatio="none"` for charts that contain text, it stretches glyphs. Two grouped bars per month (success / danger) plus tendency polylines connecting bar tops. Account selector uses a hidden `<span class="select-fit-mirror">` to size the native `<select>` to its selected option + arrow padding. Hover tooltip is positioned near the cursor (`tooltipLeft = clamp(centerX − 100, 4, containerWidth − 204)`), not pinned to a corner
- `arrow-trend-up` → **EstimationSheet** (Net worth estimation): LayerCake line+area like NetWorthSheet, but the path is split into a **solid actual segment** and a **dashed projected segment** sharing a bridge point, rendered by `EstimationPaths.svelte`. Controls (mode toggle + `<input type="month">` start/end) all live in one `.sheet-controls-row` that reuses `.sheet-range-toggle` and `.sheet-account-filter` (the latter's CSS now targets both `select` and `input`). Modes: `rate` (Rate %/mo — compound monthly rate `(last/first)^(1/n) − 1`) and `saving` (Saving €/mo — average monthly delta `(last − first)/n`). **The projection factor is derived server-side from the historical actuals; it is not a user input.** 4 KPI tiles: Current / Monthly rate or Monthly saving / Final estimate / % Change. Backend response is the object `{ points, rate, saving }`, not a bare array — `EstimationResultSchema` reflects that

### Stats sheets — shared patterns

- **Date ranges**: `3M` / `6M` / `1Y` are inclusive month boundaries — `3M` from today _Apr 15_ means the **first day of `month − 2`** (so Feb 1), not 90 days ago. `YTD` = Jan 1 current year. `All` omits `from` so the backend defaults to the earliest transaction date. Build the start date as `new Date(y, m - (N - 1), 1)`
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

## Domotics domain — quick rules

Route: `/domotics` (semiprivate), a shell with two tabs — `/domotics/printers` and `/domotics/lights`. `/domotics` itself redirects to the printers tab, and the old `/printers` 308s to `/domotics/printers` so existing bookmarks survive. Client code lives in `src/lib/domains/domotics/{printers,lights}/`, server code in `src/lib/server/domotics/{printers,lights}/`. The shell and everything lights-related is styled in `domotics.css`; printer furniture stays in `printers.css`. Both are imported by `/domotics/+layout.svelte` — the root layout imports neither.

### Printers tab

Everything printer-facing is server-only — RTSP URLs and PrusaLink credentials live in `src/lib/server/domotics/printers/` and never reach the browser. `BODY_SIZE_LIMIT` is a required prod setting; the 512K default rejects every real gcode upload.

- **Three ffmpeg lifecycles, deliberately separate**: `camera.ts` keeps one warm process per printer for the live MJPEG preview and kills it after 30s idle; `recordings.ts` spawns its own for a recording and keeps it alive until stopped. Never merge them — the preview must idle out while a recording must not
- **Recording is a backend job**: `POST /domotics/printers/[id]/recordings?action=start|stop` starts/stops ffmpeg in the server process. It keeps running with the page closed, and a returning page just sees it still going. The client controller holds no recording state of its own, only what the server reports
- **Recordings are their own metadata**: file name = UTC start time (`2026-08-06T14-32-05.mp4`), mtime = end time, size = size. There is no sidecar and no database, so a restart mid-recording loses the ffmpeg handle but never the recording. `parseRecordingName()` is therefore also the sanitizer — nothing but a timestamp this app generated matches, which is what keeps a client-supplied name from escaping the printer's folder
- **Fragmented MP4** (`+frag_keyframe+empty_moov+default_base_moof`) with `-c:v copy`: no re-encode, and the file stays playable even when the process is SIGKILLed or the container restarts. Stop writes `q` to ffmpeg's stdin (graceful) before escalating to signals
- **Recordings need a volume**: `PRINTER_RECORDINGS_DIR` (default `data/recordings`) is mounted as a named volume in `docker-compose.yml`. Without it every recording dies with the container. Retention is `PRINTER_RECORDINGS_MAX_GB` per printer, pruned oldest-first before each new recording
- **Playback honours `Range`**: `/domotics/printers/[id]/recordings/[name]` answers 206 with `Content-Range`, which is what `<video>` needs to seek. Same route serves the `.jpg` poster ffmpeg extracts when a recording ends

### Lights tab (BLE bulbs)

**The lights backend is in gv-api, not here** — including the Bluetooth itself, which now runs
on the API host over BlueZ. This tab is an interface over `/domotics/lights*`, reached through
the normal `fetchAPI` client like tasks or money; there is no `+server.ts` in front of it. It
briefly lived in `src/lib/server/`, which made this app a backend and forced gv-android to call
it; see `gv-api/docs/api/lights.md` for the real thing.

- **SSR must not wait on the radio**: the loader races the state read against 1.5s and falls
  back to an empty list, because a cold BLE connect measured ~11s and would otherwise hold the
  page blank for all of it. The client's first poll fills in what missed the cut
- **Writes are optimistic and throttled**: `LightsController` applies a change locally, then
  reconciles with the server's answer. Sliders keep one write in flight per (bulb, control)
  with a trailing send — without it a colour drag queues sixty writes and the bulb stops
  answering. Polling holds back for `POLL_GRACE_MS` after a local change so it can never walk
  the user's action back, though it always takes the server's word on reachability
- **Never infer power from brightness or colour.** Those are separate frames on the hardware;
  a dimmed bulb that is off stays off. Assuming otherwise made the card read "on" over a dark
  room and made "All on" a no-op, since every bulb already looked on
- **Which bulbs exist is editable from this tab**: `AddLightSheet` scans (`GET
/domotics/lights/discover`, which holds the request open for the length of the scan), you pick
  one off the list and name it. `EditLightSheet` renames or removes. Both go through
  `LightsController`, which reloads the registry and forces a state read afterwards — a bulb
  added a second ago has nothing in the API's cache, and a renamed one still has its old name
  there
- **`merge()` builds from the server's list, not the local one**, so a bulb added or removed
  anywhere shows up. Doing it the other way round left the page permanently empty whenever the
  SSR read timed out, because nothing could be added to an empty list
- **Polling pauses while a scan runs** — a scan owns the radio for its whole window, and reads
  fired into it just time out and slow the scan down
- **A BLE bridge daemon used to live here** under `scripts/ble-bridge/`, back when the server
  had no radio. It is gone: gv-api talks to BlueZ directly

## Welcome page (`/`)

Public portfolio/landing page at `src/routes/+page.svelte` — no auth required, fully open. Content is hardcoded (no API calls): CV summary, skills chips, language chips, certifications & awards grid, 3 featured Gitea projects in a 3-column grid. Styles in `src/styles/welcome.css` (uses `main:has(.welcome-page)` to zero out `main`'s `py-8` so the header sits flush). CV PDF is served statically from `static/CV.pdf`.

**Header on `/`**: The app header (`+layout.svelte`) always renders on `/` regardless of auth state. When unauthenticated, it shows a login icon (lock) in place of home/logout. When authenticated, it shows the normal nav.

## Deployment

Push to `main` triggers Gitea Actions deploy (Docker). Active development on `develop` branch, merge to `main` to deploy.
