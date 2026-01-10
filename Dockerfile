FROM oven/bun:latest AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_URL
ARG WEB_URL
ENV VITE_API_URL=$VITE_API_URL
ENV WEB_URL=$WEB_URL

RUN bun run build 

FROM oven/bun:latest
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "./build/index.js"]
