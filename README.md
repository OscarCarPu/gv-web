# gv-web

SvelteKit frontend for **GV** — a personal productivity app with habit tracking and task/time management.

## Tech Stack

- **SvelteKit 2** + **Svelte 5** (runes API)
- **Tailwind CSS 4** (Vite plugin, custom dark theme)
- **Zod 4** for runtime validation
- **Flowbite Svelte** for UI primitives
- **FontAwesome** icons
- **TypeScript**

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime
- A running instance of the GV API

### Environment

Copy `.env.example` and adjust values:

```sh
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API URL used by the browser (e.g. `http://localhost:8080`) |
| `API_URL` | API URL used by the server / Docker (e.g. `http://gv-api:8080`) |
| `ORIGIN` | Public URL of this app for CSRF (e.g. `http://localhost:3000`) |

### Development

```sh
bun install
bun run dev
```

### Docker

```sh
make up
```

## Documentation

See the [`docs/`](docs/) folder for detailed documentation:

- [Architecture](docs/architecture.md) — tech stack, project structure, API layer, auth, styling
- [Habits](docs/habits.md) — habit tracking feature
- [Tasks](docs/tasks.md) — task/time management feature
