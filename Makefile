dev:
	bun run dev

deploy:
	bun install --frozen-lockfile
	bun run build 
	pm2 restart gv-web || pm2 start build/index.js --name gv-web
