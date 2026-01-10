dev:
	bun run dev

include .env
export $(shell sed 's/=.*//' .env)

deploy:
	bun install --frozen-lockfile
	bun run build 
	pm2 restart gv-web --update-env || PORT=3000 pm2 start "bun ./build/index.js" --name gv-web
