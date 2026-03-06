up:
	docker compose up -d --build

up-dev:
	API_URL=http://localhost:8080 bun --env-file=.env run dev

deploy:
	git checkout main
	git merge develop
	git push
	git checkout develop
