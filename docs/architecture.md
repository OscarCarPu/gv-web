# Architecture

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| SvelteKit | 2 | Application framework (SSR, routing, server hooks) |
| Svelte | 5 | UI framework (runes API: `$state`, `$derived`, `$effect`) |
| Tailwind CSS | 4 | Utility-first styling (Vite plugin, `@theme` directive) |
| Zod | 4 | Runtime schema validation for API responses |
| Flowbite Svelte | 1.x | UI component primitives |
| FontAwesome | 7 | Icon library |
| TypeScript | 5 | Type safety |

## Project Structure

```
src/
├── routes/                    # SvelteKit file-based routing
│   ├── login/                 # /login, /login/2fa
│   ├── habits/                # /habits
│   ├── tasks/                 # /tasks
│   │   └── projects/[id]/     # /tasks/projects/:id (project detail)
│   ├── logout/                # /logout
│   ├── +layout.server.ts      # Root layout server load
│   └── +layout.svelte         # Root layout (nav, global styles)
├── lib/
│   ├── domains/               # Domain-driven feature modules
│   │   ├── auth/              # api/, types/
│   │   ├── habits/            # api/, types/, components/
│   │   └── tasks/             # api/, types/, components/
│   ├── shared/                # Reusable cross-domain code
│   │   ├── api/               # fetchAPI() client
│   │   ├── components/        # Shared UI (Modal, BottomSheet, FloatingReminder, Chart, etc.)
│   │   ├── stores/            # Svelte stores
│   │   └── utils/             # Utility functions (datetime.ts, etc.)
│   └── config/                # Environment config (env.ts)
├── styles/                    # Global and per-feature CSS
│   ├── app.css                # Tailwind imports, @theme tokens, base styles
│   ├── components.css         # Shared component styles
│   ├── habits.css             # Habits feature styles
│   ├── tasks.css              # Tasks feature styles
│   └── login.css              # Login page styles
└── hooks.server.ts            # Auth guard, security headers
```

## Routing

| Route | Purpose |
|---|---|
| `/login` | Password authentication |
| `/login/2fa` | Two-factor authentication |
| `/habits` | Habit tracking (default after login) |
| `/tasks` | Task/time management |
| `/tasks/projects/[id]` | Project detail and children |
| `/logout` | Session termination |

## API Layer

The generic API client lives in `src/lib/shared/api/client.ts`:

```ts
fetchAPI<T>(endpoint, schema, options?)
```

- Resolves base URL: `VITE_API_URL` in browser, `API_URL` on server (for Docker networking)
- Injects `Authorization: Bearer <token>` header when a token is available
- Validates response data against a Zod schema before returning
- Handles 204/void responses gracefully

Each domain module defines its own API functions (e.g. `src/lib/domains/habits/api/`) that call `fetchAPI` with the appropriate schemas.

## Authentication

1. User submits password at `/login`
2. If 2FA is enabled, redirected to `/login/2fa` for TOTP code
3. On success, JWT is stored as an httpOnly cookie (`session`, 30-day expiry)
4. `hooks.server.ts` validates the JWT on every request:
   - Invalid/missing token on protected routes → redirect to `/login` (or 401 JSON for API requests)
   - Valid token on public routes → redirect to `/habits`
5. Token is passed to server-side `fetchAPI` calls via `event.locals.token`

### Security Headers

Set in `hooks.server.ts` on every response:

- `Content-Security-Policy` — restricts sources, allows API origin for `connect-src`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

## Styling

Tailwind CSS 4 with the Vite plugin (`@tailwindcss/vite`). No `tailwind.config` file — configuration uses the CSS-native `@theme` directive.

### Theme Tokens

Defined in `src/styles/app.css` inside the `@theme` block:

- `--color-primary`, `--color-secondary` — brand colors
- `--color-bg`, `--color-bg-light` — dark background tones
- `--color-text`, `--color-text-muted` — text colors
- `--color-success`, `--color-info`, `--color-danger`, `--color-warning` — semantic colors
- `--color-border`, `--color-border-light` — border colors (use these instead of hardcoded `rgba()`)
- `--font-sans` — Inter font stack
- `--font-mono` — JetBrains Mono (timers, numeric displays)

### Responsive Design

The app uses a single custom breakpoint — `desktop` at 1000px — instead of Tailwind's default set. All default breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) are disabled.

- **Below 1000px:** Mobile/split-screen layout (single column). This is the default when two apps are placed side by side on a standard 1920px display (~960px each).
- **1000px and above:** Desktop/full-screen layout (multi-column). Habits show 3 columns; tasks show 2 columns.

Usage in CSS: `desktop:grid-cols-3`, `desktop:flex-row`, etc.

### Shared Utilities (`@utility`)

`components.css` defines reusable base utilities via Tailwind's `@utility` directive, making them composable with `@apply` across all CSS files:

| Utility | Purpose |
|---|---|
| `btn` | Base button styles (flex, padding, rounded, font, cursor, transition) |
| `status-badge` | Small pill badge (text-xs, rounded-full, muted colors) |

These are extended by regular classes (e.g. `.btn-primary { @apply btn bg-primary ... }`). See `docs/styling.md` for the full class inventory.

### Per-Feature CSS

Feature CSS files (e.g. `habits.css`, `tasks.css`) use `@reference "./app.css"` to access theme tokens without duplicating Tailwind's output. Component `<style>` blocks follow the same pattern.

## Environment

| Variable | Context | Purpose |
|---|---|---|
| `VITE_API_URL` | Browser (Vite-injected) | API base URL for client-side fetch |
| `API_URL` | Server (Node.js) | API base URL for SSR fetch (Docker service name in production) |
| `ORIGIN` | Server (adapter-node) | Public origin for SvelteKit CSRF protection |
