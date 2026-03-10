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
