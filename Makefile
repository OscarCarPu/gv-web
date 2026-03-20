.PHONY: up up-dev test-coverage test

up:
	docker compose up -d --build

up-dev:
	rm -rf .svelte-kit
	API_URL=http://localhost:8080 bun --env-file=.env run svelte-kit sync && API_URL=http://localhost:8080 bun --env-file=.env run dev

test-coverage:
	bun run vitest run --coverage
	uv run scripts/coverage.py

test:
	bun run test:unit -- --run && bun run test:e2e
