up:
	docker compose up -d --build

up-dev:
	bun --env-file=.env run dev
