.PHONY: up up-dev down lint check test test-coverage

up:
	docker compose up -d --build

up-dev:
	rm -rf .svelte-kit
	API_URL=http://localhost:8080 bun --env-file=.env run svelte-kit sync && API_URL=http://localhost:8080 bun --env-file=.env run dev

test-coverage:
	bun run vitest run --coverage
	uv run scripts/coverage.py

lint:
	bun run lint

check:
	bun run check

test:
	bun run test:unit -- --run

down:
	docker compose down -v
