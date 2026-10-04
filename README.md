# Gymtime

[![CI](https://github.com/mikezupper/gymtime/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mikezupper/gymtime/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/mikezupper/gymtime)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/mikezupper/gymtime)](https://github.com/mikezupper/gymtime/issues)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen)](CONTRIBUTING.md)
[![Rust](https://img.shields.io/badge/Rust-1.99.0-000000?logo=rust)](rust-toolchain.toml)
[![Node.js](https://img.shields.io/badge/Node.js-24.21.0-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![Lit](https://img.shields.io/badge/UI-Lit-324FFF?logo=lit&logoColor=white)](apps/web/package.json)
[![Docker Compose](https://img.shields.io/badge/deployment-Docker_Compose-2496ED?logo=docker&logoColor=white)](compose.yaml)

Gymtime helps a school or local gym organizer plan a season of basketball gym access. Organizers publish available time, coaches request slots, and families follow their team's confirmed schedule.

## Why Gymtime exists

Sharing one gym across several teams often means maintaining a spreadsheet and coordinating changes through email and conversations. Coaches need to know which times are available; organizers need to resolve competing requests; parents need a reliable schedule when plans change. Gymtime brings those tasks into one workspace while leaving scheduling decisions with the organizer.

It manages access to a gym. It does not generate opponents, league schedules, or game matchups.

## What works today

- One gym per database, with full-gym and optional Half A / Half B spaces.
- Opening hours, draft and active seasons, published slots, and closures.
- Invitation-only email-code sign-in, multiple organizers, and primary and assistant coaches. A coach can belong to several teams.
- A calendar and time finder with persistent selections, weekly repetition, and excluded-date review.
- Pending requests grouped for review, competing-request reasons, partial recurring decisions, and searchable history.
- Booking changes, immediate coach cancellations, and reciprocal swaps accepted by the other primary coach.
- Team notifications and durable email delivery using the Resend SDK with a configurable compatible endpoint.
- Team-only parent webpages and subscribable `.ics` calendars, without parent accounts. Internal notes and pending requests stay in the coach workspace.
- Organizer onboarding, permission-aware coach guides, parent subscription instructions, contextual help, and mobile and dark-mode views.

This is an early, pre-1.0 project. Automated checks cover Chromium and WebKit, SQLite transactions, and public-calendar privacy. See [verification evidence and limits](docs/verification.md). Production deployment, live email delivery, and real calendar-provider refresh behavior need validation in your environment.

Two independent schools can run separate instances with their own databases, hostnames, and configuration. The application has no school switcher or shared multi-school tenancy. Separate instances behind one Traefik proxy also need unique router and service label names.

## Run locally

You need Git, Node **24.21.0**, pnpm **12.8.2**, Rust **1.99.0**, and a C compiler/platform build tools. Toolchain versions are recorded in [.node-version](.node-version), [package.json](package.json), and [rust-toolchain.toml](rust-toolchain.toml). Docker is optional for native development.

```bash
git clone https://github.com/mikezupper/gymtime.git
cd gymtime
corepack enable
pnpm install --frozen-lockfile
rustup show
pnpm dev
```

Open **http://localhost:5177**. Sign in as `organizer@example.test` and read the six-digit code at **http://localhost:8027/messages**. Rust runs on port 3017. The local email sandbox captures messages and sends no real email.

Startup creates `.local/gymtime.db`, applies migrations, and bootstraps the first organizer. A fresh instance has no teams or season bookings. Open **Help → Set up your season** to define the gym, create a season, invite coaches, publish slots, activate the season, and share parent links. Coach and parent instructions are in the app and the [role walkthrough](docs/workflows.md).

Development commands read exported environment variables; they do not load `.env` automatically. For example:

```bash
INITIAL_ORGANIZER_EMAIL=organizer@example.test DEV_DATABASE_URL=sqlite://.local/another-gym.db pnpm dev
```

Changing the bootstrap email does not replace an organizer in an existing database. See [local development](docs/development.md) for isolated ports and containers.

## Configuration

Production Compose reads a private `.env` copied from [.env.example](.env.example). Replace every placeholder. Native development supplies sandbox defaults; production uses your email service and secrets.

| Setting | Purpose |
| --- | --- |
| `APP_HOST` / `APP_PUBLIC_URL` | Public hostname and matching HTTPS origin |
| `APP_PORT` | Internal HTTP port; Compose defaults to `3000` |
| `INITIAL_ORGANIZER_EMAIL` | First organizer, created only when no organizer exists |
| `AUTH_SECRET` | At least 32 random bytes, used by authentication |
| `RESEND_BASE_URL` / `RESEND_API_KEY` | Resend-compatible email API endpoint and key |
| `EMAIL_FROM` | Sender identity accepted by your email service |
| `TRUSTED_PROXY_CIDRS` | Narrowly scoped trusted proxy networks for forwarded client addresses |
| `TRAEFIK_NETWORK` / `TRAEFIK_ENTRYPOINT` / `TRAEFIK_CERT_RESOLVER` | Existing Traefik network, entrypoint, and HTTPS resolver |
| `DATABASE_URL` | SQLite connection URL; Compose supplies `sqlite:///data/gymtime.db` |
| `ASSETS_DIR` | Built frontend directory; the image supplies `/app/assets` |

Keep secrets, `.env`, databases, backups, sign-in captures, and local task records out of Git. Parent links also carry access tokens; do not include a real team's link in an issue or screenshot.

## Build and verify

Install the additional check tools and browser engines:

```bash
cargo install --locked cargo-nextest --version 0.9.143
cargo install --locked cargo-deny --version 0.20.2
pnpm exec playwright install --with-deps chromium webkit
```

Then run:

```bash
pnpm check
pnpm test:unit
pnpm test:browser
pnpm test:e2e
pnpm build
```

| Command | Result |
| --- | --- |
| `pnpm check` | TypeScript, ESLint, strict Lit templates, Rust formatting/Clippy, dependency policy, architecture, contracts, migrations, docs, and public skill hashes |
| `pnpm test:unit` | Vitest, Rust nextest, and Rust doctests |
| `pnpm test:browser` | Real custom-element tests in Chromium and WebKit |
| `pnpm test:e2e` | Full-stack browser tests with fresh SQLite and a local email sandbox |
| `pnpm build` | Generated contracts, frontend assets, and `target/debug/gymtime-server` |
| `pnpm contract:generate` / `pnpm schema:generate` | Regenerate API types or migration documentation after changing their sources |
| `pnpm docs:check` / `pnpm architecture:check` | Focused documentation or boundary checks |

The Docker build creates the optimized Rust release binary and packages it with frontend assets. Node is a build dependency and is absent from the application runtime image. CI runs checks, tests, the native build, and a container build. Local database and browser reports remain ignored.

## Deploy with Docker Compose

The supplied production configuration targets **Linux x86_64** and an **existing Traefik proxy**. It adds only the application service and uses Traefik labels; it does not install a proxy or publish a host port.

```bash
cp .env.example .env
# Edit .env with your hostname, email settings, secrets, and Traefik values.
docker compose --env-file .env config --quiet
docker compose --env-file .env build app
docker compose --env-file .env up -d app
docker compose --env-file .env exec app curl --fail --silent http://127.0.0.1:3000/health/ready
```

SQLite lives in the persistent `gymtime-data` volume. Container replacement keeps that volume; removing volumes deletes data. Migrations run before readiness. The image runs as UID/GID 10001, so mounted database directories must be writable by that identity. Changing the public origin requires rebuilding the frontend's canonical URL and sitemap.

Use [VPS operation](docs/deployment.md) for proxy configuration, backups, restore checks, and container replacement. A database migration is not undone by reverting an image. Keep a consistent backup and verify restore before upgrading a live instance. For local container testing without Traefik, use `compose.dev.yaml` as described in [development](docs/development.md).

## Architecture

Gymtime is one repository with a Rust service, a Lit frontend, generated contracts, and project documentation.

| Area | Ownership |
| --- | --- |
| `crates/domain` | Pure types and scheduling decisions; no HTTP or database drivers |
| `crates/app` | Use cases, permissions, ports, and transaction boundaries |
| `crates/infra` | SQLite persistence, authentication infrastructure, email, and outbox delivery |
| `crates/api` | Axum routes, boundary DTOs, validation, errors, and OpenAPI annotations |
| `crates/server` | Configuration, migrations, dependency wiring, assets, readiness, and shutdown |
| `apps/web` | Lit rendering and lifecycle; Effect workflows, decoding, and one browser runtime adapter |
| `contracts` / `packages/contracts` | Generated OpenAPI and TypeScript transport types |
| `docs` | Requirements, design decisions, role workflows, operation, and verification evidence |

Rust authorizes every schedule mutation. Conflict checks and writes happen in one SQLite write transaction. Approval cancels physical competitors; compatible half-gym requests stay separate. Swaps update both bookings together. Notifications are queued durably with committed changes.

The frontend improves interaction without taking over authorization. Public calendar DTOs are separate projections that omit private notes, coach emails, and pending requests. Stable calendar event identities survive moves and cancellations. Parent pages and feeds are excluded from search; the landing page is indexable.

Read [backend architecture](ARCHITECTURE.md), [frontend architecture](docs/frontend.md), and the [OpenAPI contract](contracts/openapi.json) before changing these boundaries.

## Conventions and contributions

Public contributors are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md), and [Security policy](SECURITY.md).

Use typed errors and boundary decoding, keep domain decisions pure, respect role permissions, and test changes at the layer where their behavior lives. Use semantic HTML, native controls, accessible names, and responsive CSS. Update requirements or design documents when behavior changes. [Writing conventions](docs/writing.md) describe the documentation and interface-copy standard.

GitHub issues are the public intake for bugs, proposals, and support. Maintainers and agents use Beads for local execution tracking; its database is not published. [AGENTS.md](AGENTS.md) maps the repository for coding agents. No co-author trailers should be added to commit messages or PR descriptions.

Seven public development skills are pinned under `.agents/skills` with provenance in [skills.lock.json](skills.lock.json). They are development guidance, not application dependencies. Check local hashes with `pnpm skills:check -- --offline`; online checks and explicit updates are described in [engineering decisions](docs/engineering.md). Private guidance remains outside the public tree.

## Project documentation

- [Requirements](docs/requirements.md) and [role workflows](docs/workflows.md)
- [Onboarding and contextual help](docs/onboarding-and-help.md)
- [Engineering decisions](docs/engineering.md) and [scaffold specification](docs/scaffold.md)
- [SQLite schema](docs/schema.md)
- [Local development](docs/development.md), [deployment](docs/deployment.md), and [verification](docs/verification.md)
- [Harness engineering approach](docs/references/openai-harness-engineer.md)

## License

Gymtime's original application code and project documentation are licensed under [MIT](LICENSE). Copied development skills retain their own licenses and attribution; see [Third-party notices](THIRD_PARTY_NOTICES.md). Dependency licenses remain with their respective projects.
