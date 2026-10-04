# Local development

The app serves a static landing page and a Lit workspace connected to Rust and SQLite. Invited users can sign in with emailed codes. Organizers can invite and disable accounts. Organizers manage seasons, teams, slots, and closures. Primary coaches request, change, cancel, and swap bookings; parents use shared calendars. Follow the [role walkthrough](workflows.md) to try these features.

## Install and run

Use Node 24.21.0, pnpm 12.8.2 through Corepack, and the Rust toolchain selected by `rust-toolchain.toml`. Install `cargo-nextest` and `cargo-deny` for the documented checks, and Beads for task tracking. Rust builds need a C compiler and the usual platform build tools. Docker Compose is optional for native development.

```bash
corepack enable
pnpm install --frozen-lockfile
rustup show
pnpm exec playwright install chromium webkit
pnpm dev
```

On Linux, Playwright may also need system libraries; use `pnpm exec playwright install --with-deps chromium webkit` on a machine where installing those libraries is appropriate.

Open `http://localhost:5177`. Vite proxies health, API, and `/calendars` feed requests to Rust on port 3017, so parent subscriptions and downloads use the same web origin. The local email sandbox listens on port 8027; its captured messages are at `http://localhost:8027/messages`. All native development listeners default to loopback. Run `pnpm dev` directly in a shell using the pinned Node version; Ctrl+C stops the coordinated processes. External command wrappers that forcibly terminate the parent can bypass its cleanup.

Local startup creates `.local/gymtime.db`, applies migrations, and bootstraps the fake `organizer@example.test` account. Sign in with that address and read its six-digit code in the sandbox inbox. The sandbox accepts only `local-test-key` and sends no email. Its inbox holds the latest 100 messages and resets when restarted. Invitation emails come from the durable outbox; OTPs are sent directly and their plaintext is never stored there.

Set `INITIAL_ORGANIZER_EMAIL` to use another organizer when bootstrapping a new development database. Keep personal preview configuration and database files local. Select a separate file through `DEV_DATABASE_URL` to preserve existing test data. Changing the email does not replace an organizer in an existing database.

For a separate worktree, set distinct `DEV_API_PORT`, `DEV_WEB_PORT`, `DEV_EMAIL_PORT`, and `DEV_DATABASE_URL` environment values. These commands read environment values; they do not automatically load `.env.example`. Create a database's parent directory before selecting a custom file location.

```bash
DEV_API_PORT=3027 DEV_WEB_PORT=5187 DEV_EMAIL_PORT=8037 pnpm dev
```

`pnpm dev:api` starts Rust and the local email sandbox. To serve its landing page and preview directly, run `pnpm --filter @gymtime/web build` first, then open its API port. Health endpoints are `/health/live` and `/health/ready`. The development public URL defaults to the web port for `dev` and the API port for `dev:api`; override it with `DEV_PUBLIC_URL` when needed. Origin checks allow localhost and 127.0.0.1 on that configured port in development.

## Verify a change

```bash
pnpm check
pnpm test:unit
pnpm test:browser
pnpm test:e2e
pnpm build
```

`check` includes TypeScript, ESLint, strict Lit template analysis, Rust formatting and Clippy, dependency advisories and licenses, crate/import boundaries, generated contracts, migration documentation, documentation links, command names, example configuration names, and copied skill hashes. `test:unit` runs Vitest, Rust nextest, and Rust doctests. Browser tests use Chromium and WebKit. End-to-end tests start a separate Rust service on port 3817 and a local email sandbox on port 8827. Each run uses a fresh `.local/e2e-<process-id>.db`, separate from development data.

After changing API DTOs, run `pnpm contract:generate`. After changing migrations, run `pnpm schema:generate`. Review the generated files with their sources. The application uses runtime SQLx queries and therefore needs no `.sqlx` offline metadata.

## Run the local containers

```bash
docker compose -f compose.dev.yaml config --quiet
docker compose -f compose.dev.yaml up --build -d
curl --fail http://localhost:3017/health/ready
docker compose -f compose.dev.yaml logs app
docker compose -f compose.dev.yaml down
```

The independent development Compose file starts the built Rust app and an isolated test email service. It needs no Traefik network. Its database volume survives `down`; `down --volumes` deletes that development data. Container listeners bind internally to all interfaces, while published ports bind only to host loopback.

## Check and update copied skills

```bash
pnpm skills:check -- --offline
pnpm skills:check
pnpm skills:update -- rust-fp --revision FULL_40_CHARACTER_COMMIT_SHA
```

Offline checking verifies local hashes. Online checking requires Git access to the repositories listed in `skills.lock.json`; GitHub release discovery uses `gh` and its existing authentication. If release metadata is inaccessible, the tool explicitly reports that it checked the configured branch instead. Checking never applies changes. Upstream Git and release queries have a two-minute deadline.

Updating requires an explicit commit, refuses local edits, validates linked references and retained licenses, and prepares the copy before replacement. Instruction snapshots and any patch are saved under `.local` for review. Replacement failures restore the previous copy and pin. An abrupt process or host crash during replacement requires inspecting the staging directory and lock before retrying; ordinary command failures are handled automatically. Do not edit pinned files in place to customize project policy: record those interpretations in the project documents.

The semantic HTML source declares CC BY 4.0 in its README but has no separate license file. The manifest records the absence of that file. Source attribution and existing licenses remain in each copy; see [Third-party notices](../THIRD_PARTY_NOTICES.md).
