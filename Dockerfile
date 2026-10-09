FROM oven/bun:1.3.13 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# The deploy is a docker build, and this stage already has bun, so the checks
# run here: a broken lint, a type error or a failing test stops the image.
RUN bun run lint && bun run check && bun run test

RUN bun run build

FROM oven/bun:1.3.13-alpine
WORKDIR /app

# adapter-node bundles devDependencies into build/, and every package is a
# devDependency, so the server needs no node_modules at runtime
COPY --from=builder /app/build ./build

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "./build/index.js"]
