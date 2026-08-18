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

FROM oven/bun:1.3.13
WORKDIR /app

# ffmpeg powers the printer camera proxy (RTSP -> in-memory MJPEG frames)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "./build/index.js"]
