# Gymtime Scaffold Specification

The scaffold establishes a bootable Lit frontend and Rust service, a SQLite migration path, generated API contracts, committed skill copies, and reproducible checks. It provides the foundation for the behavior in [Requirements](requirements.md); it will not claim to implement scheduling features through placeholder screens.

This document defines the implementation contract for that foundation. The files and commands below are implemented. Product workflows now extend this foundation; their acceptance boundary is [Requirements](requirements.md). Task status belongs in Beads. The architecture is defined in [Architecture](../ARCHITECTURE.md) and [Frontend architecture](frontend.md).

## Repository layout

```text
AGENTS.md                      short contributor and agent navigation
ARCHITECTURE.md                 runtime, domain, and dependency boundaries
README.md                      project entry and development instructions
docs/                          requirements, designs, and operating guidance
.agents/skills/                committed, pinned skill material
skills.lock.json               skill provenance and update configuration
package.json                   root development and verification commands
pnpm-workspace.yaml
pnpm-lock.yaml
rust-toolchain.toml
Cargo.toml
Cargo.lock
apps/web/                      Lit application and landing-page generation
packages/contracts/            generated TypeScript transport package
contracts/openapi.json         generated public HTTP contract
crates/domain/                 gymtime-domain
crates/app/                    gymtime-app
crates/infra/                  gymtime-infra
crates/api/                    gymtime-api
crates/server/                 gymtime-server; production wiring and binary
migrations/                    ordered SQLite migrations
.sqlx/                         SQLx offline query metadata when macros are used
tools/                         contract, architecture, docs, and skill tooling
Dockerfile                     staged frontend and Rust build
compose.yaml                   production app and external Traefik integration
compose.dev.yaml               independent local setup with test email API
.env.example                   names and safe examples, without secrets
```

Do not create empty packages or documentation trees. Each initial crate must have a compiling responsibility and explicit dependency boundaries. Tooling can start as small typed scripts rather than a separate framework. Each Effect-based command has its own composition root; production browser runtime execution stays in its single adapter.

The first scaffold serves a generated landing page, the interactive document shell, structured health responses, and a minimal generated contract. It establishes configuration parsing, SQLite migration/startup behavior, transaction ownership, and graceful shutdown. Feature-specific tables and endpoints now support scheduling and calendars. Screens use the real API rather than simulating successful bookings.

## Toolchain baseline

The baseline pins were resolved and built on October 2, 2026; the selected Rust maintenance updates were verified on October 4. Lockfiles record the complete dependency graphs. Verification includes the installed compiler, pinned Node runtime, frontend build, Rust checks, and browser tests.

| Tool or dependency | Pin | Selection |
| --- | --- | --- |
| Node | `24.21.0` | LTS line, frontend builds only |
| pnpm | `12.8.2` | Exact root `packageManager` value |
| TypeScript | `5.9.3` | Compatible with the selected transport generator |
| Vite | `8.3.2` | Frontend development and production asset build |
| Lit | `3.3.3` | Components and templates |
| Effect | `3.22.2` | The requested skill targets version 3 |
| `@effect/platform` | `0.97.2` | Companion version whose peer range accepts this Effect version |
| `@effect/language-service` | `0.87.3` | Effect editor and diagnostic integration |
| `@lit/context` / `@lit/task` | `1.1.6` / `1.0.3` | Stable context and asynchronous rendering |
| `@lit-labs/signals` | `0.3.0` | Shared reactive state; one transitive polyfill |
| `@lit-labs/ssr` | `4.1.0` | Build-time landing rendering only |
| Vitest / `@vitest/browser-playwright` | `4.1.11` / `4.1.11` | Matching browser test runner and provider |
| Playwright | `1.63.0` | Browser verification |
| `openapi-typescript` | `7.13.0` | Generated transport declarations |
| Rust | `1.99.0`, edition `2024` | Exact compiler in `rust-toolchain.toml` |
| Axum / Tokio | `0.8.9` / `1.53.1` | HTTP and structured asynchronous execution |
| SQLx | `0.9.0` | SQLite; requires Rust 1.94 or newer |
| `resend-rs` | `0.33.0` | Custom endpoint, authentication, request format, and retry behavior verified by adapter tests |
| `tower-http` | `0.7.1` | HTTP middleware; compiled and verified through full-stack browser tests |
| `getrandom` / `ipnet` | `0.4.3` / `2.12.2` | Infrastructure randomness and trusted proxy networks; existing tests passed |
| Utoipa | `6.0.0` | Rust-derived OpenAPI |
| `thiserror` / `proptest` | `2.0.21` / `1.11.0` | Typed Rust errors and domain property tests |

Node's [release schedule](https://nodejs.org/en/about/previous-releases) and Vite's [runtime requirements](https://vite.dev/guide/) support using Node 24. Package versions and peer constraints come from the [npm registry](https://registry.npmjs.org/) and [crates.io](https://crates.io/). Lint, template analysis, test, and build packages are pinned in the lockfiles.

The Lit skill selects Vitest 4. Effect 3's [`@effect/vitest` 0.30.0 metadata](https://registry.npmjs.org/@effect%2Fvitest/0.30.0) requires Vitest 3, so do not install that integration or a second runner. Use the scoped workflow test adapter described in the frontend document. A newer Effect major is not an automatic substitute for the requested skill's version 3 APIs.

The selected [Resend SDK documentation](https://docs.rs/resend-rs/0.33.0/resend_rs/index.html) describes the required `RESEND_API_KEY` and `RESEND_BASE_URL` behavior. The update to 0.33.0 passed the existing custom-endpoint adapter test. Later SDK versions can be adopted when those tests demonstrate the same behavior; an update is not required merely because the registry lists it.

Commit application lockfiles, the exact package manager and compiler selections, and the final tested version table. Container builds use those locks and frozen installs. Resolve and record base-image digests when creating the Dockerfile. Run verification locally through `pnpm run ci`; GitHub Actions and automatic dependency-update PR creation are disabled. Do not use `latest` as a reproducibility policy.

## Development commands

These root commands are the scaffold interface.

| Command | Expected behavior |
| --- | --- |
| `pnpm run ci` | Run the full local checks, tests, native build, and production container build; stop on failure |
| `pnpm dev` | Start Vite and Rust with coordinated shutdown and a same-origin API proxy |
| `pnpm dev:api` | Start just the Rust service with local configuration |
| `pnpm check` | Type, template, lint, formatting, Rust lint, architecture, contract, and documentation checks |
| `pnpm test:unit` | Pure and service tests, including Rust tests and SQLite integration tests |
| `pnpm test:browser` | Lit component tests in real browsers |
| `pnpm test:e2e` | Full-stack Playwright tests with isolated database and email state |
| `pnpm build` | Generate landing/assets/contracts and compile the Rust application |
| `pnpm contract:generate` | Export OpenAPI from Rust and regenerate TypeScript transport types |
| `pnpm schema:generate` | Regenerate the migration reference from SQL files |
| `pnpm contract:check` | Generate to a temporary directory and fail on drift without changing committed outputs |
| `pnpm skills:check` | Report upstream changes without altering committed skills |
| `pnpm skills:update -- <name> --revision <sha>` | Apply one explicitly selected, reviewable skill revision |

Scripts must return a nonzero exit code on failure and identify the failed check and repair. Tool subprocesses inherit only needed configuration. Commands that inspect configuration must avoid printing secret values.

Document setup prerequisites and the installation command after verifying them on a fresh checkout. Local bootstrap provides a fake organizer. The end-to-end setup creates a sample season through the API. Ordinary development starts with organizer bootstrap and lets the user create gym settings and teams. Seed commands operate only on an explicitly designated development database and never bootstrap sample data into production.

Use separate development ports, database paths, and email state for each worktree. Configuration supports `DEV_API_PORT`, `DEV_WEB_PORT`, and a worktree-local data directory. The `.beads` task store is not the application's SQLite database. Ignore local data, real environment files, and build output; retain `.env.example` and required generated contracts.

## Contract and architecture enforcement

Rust API DTOs and route annotations generate `contracts/openapi.json`. `packages/contracts` exposes generated transport types. The generator must not start the HTTP server, send email, or open the production database. API schemas and generated output are reviewed together.

Enforce Rust crate dependencies from Cargo metadata and reject framework or driver dependencies in the domain. Prevent infra imports from app or API. Use strict TypeScript, Lit template analysis, and lint rules to enforce the frontend import map, named errors, and runtime execution boundary. Generated files are exempt from hand-authored style rules, not from contract drift checks.

SQL migrations apply in order before readiness and enable foreign keys. If SQLx compile-time query macros are used, generate offline metadata against a migrated temporary SQLite database and verify it in CI. Do not require a running production database to compile. Generate readable schema documentation from migrations when actual tables exist.

Documentation checks validate repository links, referenced skill entrypoints, configuration names, and implemented command names. A specification may mention a future artifact as code text; it must not present a broken file link as an existing document. Commands graduate from planned to usable only after they run successfully.

## Pinned skills and manual updates

Copy the public skill packages listed in [Engineering decisions](engineering.md) under `.agents/skills`. Keep instructions, required supporting references, attribution, and licenses. Export tracked material from an identified upstream commit rather than silently incorporating uncommitted source edits. Exclude private, ignored, credential, cache, and build assets. If local edits are intended guidance, resolve their provenance before calling the copy pinned.

`skills.lock.json` records each skill's name, upstream repository, source directory, source entry filename, selected tag when present, commit, update branch, license files, and content hashes. Preserve the semantic HTML source filename `skills.md` in provenance if it is normalized to a local `SKILL.md`. The local Beads entry comes from `skills/beads/SKILL.md`, not a similarly named bundled copy elsewhere in its source repository.

The check command reports changes on the configured release or branch policy. It does not install, modify the manifest, or update instructions. Handle missing credentials, missing releases, and unreachable sources as explicit per-source results rather than reporting everything current.

The update command resolves an explicit revision, prepares the copied material and manifest together, and shows a reviewable instruction diff. Refuse to overwrite locally edited copies without resolving those edits. Validate reference paths, provenance, hashes, and required license material before replacement. An unsuccessful update leaves the existing copy and manifest intact. Do not run scheduled updates or create automatic update pull requests.

After copying, update the root guide and document links to use the committed entrypoints. Keep the documented interpretations of the styled Lit app, Effect/Lit boundary, Vitest compatibility, and SQLite adaptation when reviewing changed upstream guidance.

## Docker and configuration

The production `compose.yaml` contains one application service, a persistent local SQLite volume, and the owner's external Traefik network. It declares Traefik router, TLS, network, and internal service-port labels. It does not create Traefik. Build a non-root `linux/amd64` image that contains the Rust binary and built assets, with no Node runtime needed in production.

`compose.dev.yaml` is an independent local file. It does not depend on the VPS network or certificate resolver. It exposes the application on a local port and provides an isolated Resend-compatible test endpoint with inspectable messages. Backend tests may use an injected fake instead. Both setups use SQLite.

| Configuration | Purpose |
| --- | --- |
| `APP_PUBLIC_URL` | Canonical HTTPS origin and generated links |
| `APP_PORT` | Internal HTTP listener, default 3000 |
| `DATABASE_URL` | SQLite location under the persistent mounted directory |
| `INITIAL_ORGANIZER_EMAIL` | First organizer when bootstrapping an empty database |
| `AUTH_SECRET` | Cryptographic secret for OTP digests; at least 32 random bytes |
| `RESEND_BASE_URL`, `RESEND_API_KEY` | Custom compatible server endpoint and credential |
| `EMAIL_FROM` | Configured sender identity |
| `TRUSTED_PROXY_CIDRS` | Proxy addresses permitted to supply forwarded client information |
| `APP_HOST` | Traefik host rule; must match the host in `APP_PUBLIC_URL` |
| `TRAEFIK_NETWORK` | Existing external Docker network |
| `TRAEFIK_ENTRYPOINT` | Existing HTTPS entrypoint |
| `TRAEFIK_CERT_RESOLVER` | Existing certificate resolver |

Parse application configuration once into validated types. Validate the deployment host and origin together. Explicit local mode permits local HTTP and test credentials; production requires its HTTPS and secure-cookie policy. Environment examples contain names and safe placeholders, and secrets are runtime settings rather than frontend build arguments.

Provide `/health/live` and `/health/ready`. Readiness follows successful migrations and a usable database; it does not require email availability. Worker startup and HTTP startup share a shutdown scope. Keep database writes short and send email outside booking transactions.

The deployment runbook will include `docker compose config --quiet`, startup, readiness inspection, container replacement, consistent SQLite backup, restore into a separate directory, and failure recovery. Backup destination and retention are deployment choices. Rolling back an image does not automatically reverse a database migration; document supported recovery before production use.

## Scaffold acceptance

The scaffold is accepted when a fresh checkout can install frozen dependencies, compile both applications, render the landing page, boot against temporary SQLite, return the health contract, and pass the documented checks. Verify persistent data across container replacement and run the image for the intended CPU architecture. Production Compose validation must succeed with supplied routing values and contain no proxy service.

Test the first transaction adapter with separate connections to a temporary SQLite file, including rollback on failure. Feature work later adds the actual approval and swap races; do not substitute a trivial adapter test for those product acceptance cases. Test the custom email adapter's request shape, API-key authentication, configured base URL, and retry/idempotency behavior against an isolated endpoint.

Verify that public and authenticated document routes have the intended search directives, generated landing content works without JavaScript, missing routes return appropriate status, and secret configuration is absent from built assets. Skill checking must leave copies unchanged, and a failed skill update must preserve the previous pin. Run local link and architecture checks on the actual scaffold.

Beads was initialized without installing hooks or replacing the custom agent guide. The initial scaffold and pinned skill copies are implemented. No Git commit, push, or VPS deployment has occurred. See [Local development](development.md), [VPS operation](deployment.md), and [Migration reference](schema.md) for operating details.

## Compatibility decisions

ESLint is pinned to 10.11.0 with compatible TypeScript and Lit plugins. Lit analyzer 2.0.3 uses `vscode-css-languageservice` 6.3.10 through a scoped pnpm override so modern `@layer` syntax is understood. The workspace has one `signal-polyfill` 0.2.2. Vitest 4 uses hand-written Effect Layers and scoped runtime disposal instead of the incompatible Effect/Vitest 3 integration.

The Resend SDK adapter uses the SDK's raw relative `emails` request. Its convenience method uses `/emails` and discards a custom URL path prefix. Integration tests verify a prefixed endpoint, bearer authentication, request fields, a transient failure, and a stable idempotency key. The server constructs this adapter but does not send email until authentication and notification workflows exist.

The app root uses light DOM for document landmarks and native skip links. Nested Lit components retain shadow DOM. Rendering depends on supplied route state; reading the browser URL happens at client startup. The landing page is generated HTML and needs no JavaScript.

## Verification record

The initial scaffold passed the checks recorded in [Verification](verification.md). The foundation acceptance boundary is retained here. [Verification](verification.md) also records the scheduling feature checks.
