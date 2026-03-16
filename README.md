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

## Deployment

Deployments are automated via **Gitea Actions**. When code is pushed to the `main` branch, the workflow at `.gitea/workflows/deploy.yml` runs on the server and:

1. Pulls the latest code from `main`
2. Runs `make up` to rebuild and restart the Docker containers

To deploy, merge `develop` into `main` and push — the workflow handles the rest.

## Coverage

| File | Coverage |
| :--- | :---: |
| `src/lib/config/env.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/domains/auth/schemas/auth.schemas.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/domains/auth/types/Auth.types.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/domains/habits/api/habits.api.ts` | ![83.33%](https://img.shields.io/badge/83.33%25-brightgreen) |
| `src/lib/domains/habits/api/habits.schemas.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/domains/habits/types/Habit.types.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/domains/tasks/api/tasks.api.ts` | ![27.27%](https://img.shields.io/badge/27.27%25-red) |
| `src/lib/domains/tasks/api/tasks.schemas.ts` | ![94.11%](https://img.shields.io/badge/94.11%25-brightgreen) |
| `src/lib/domains/tasks/taskTimer.svelte.ts` | ![88.88%](https://img.shields.io/badge/88.88%25-brightgreen) |
| `src/lib/domains/tasks/types/Task.types.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/index.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/shared/api/client.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/shared/stores/auth.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| `src/lib/shared/utils/dateNavigation.svelte.ts` | ![100%](https://img.shields.io/badge/100%25-brightgreen) |
| **Total** | ![81.53%](https://img.shields.io/badge/81.53%25-brightgreen) |

## Documentation

See the [`docs/`](docs/) folder for detailed documentation:

- [Architecture](docs/architecture.md) — tech stack, project structure, API layer, auth, styling
- [Habits](docs/habits.md) — habit tracking feature
- [Tasks](docs/tasks.md) — task/time management feature
