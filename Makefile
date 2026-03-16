.PHONY: up up-dev deploy coverage

# Colors
CYAN=\033[0;36m
YELLOW=\033[0;33m
GREEN=\033[0;32m
NC=\033[0m

up:
	docker compose up -d --build

up-dev:
	rm -rf .svelte-kit
	API_URL=http://localhost:8080 bun --env-file=.env run svelte-kit sync && API_URL=http://localhost:8080 bun --env-file=.env run dev

deploy:
	git checkout main
	git merge develop
	git push
	git checkout develop

coverage:
	@printf "$(CYAN)>>> Running tests with coverage...$(NC)\n"
	@bun run vitest run --coverage
	@printf "$(YELLOW)>>> Updating README with coverage table...$(NC)\n"
	@uv run scripts/coverage.py
	@printf "$(GREEN)>>> Coverage report updated$(NC)\n"
