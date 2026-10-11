# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS web
WORKDIR /build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps/web ./apps/web
COPY packages/contracts ./packages/contracts
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
ARG PUBLIC_SITE_URL=http://localhost:5177
RUN PUBLIC_SITE_URL="$PUBLIC_SITE_URL" pnpm --filter @gymtime/web build

FROM web AS email-sandbox
COPY tools/email-sandbox.ts ./tools/email-sandbox.ts
USER node
EXPOSE 8027
CMD ["node", "--import", "tsx", "tools/email-sandbox.ts"]

FROM rust:1.99.0-bookworm@sha256:59037199c44290f2befcdd58dcc540164763fc296950255aaefeef096a1866b0 AS rust
WORKDIR /build
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
COPY migrations ./migrations
RUN --mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/usr/local/cargo/git cargo build --release --locked -p gymtime-server

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 gymtime && useradd --uid 10001 --gid gymtime --no-create-home gymtime && mkdir /data && chown gymtime:gymtime /data
WORKDIR /app
COPY --from=rust /build/target/release/gymtime-server /usr/local/bin/gymtime-server
COPY --from=web /build/apps/web/dist ./assets
USER gymtime
ENV APP_PORT=3000 ASSETS_DIR=/app/assets DATABASE_URL=sqlite:///data/gymtime.db
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 CMD curl --fail --silent "http://127.0.0.1:${APP_PORT}/health/ready" > /dev/null
CMD ["gymtime-server"]
