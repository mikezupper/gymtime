# Gymtime Engineering Decisions

Gymtime will use a Lit and TypeScript frontend and a Rust backend with SQLite. It will run through Docker Compose on the owner's VPS. The project will follow the harness engineering approach in the supplied reference: keep decisions in the repository, give agents a short navigation guide, enforce architecture rules with tools, and make the app easy to run and inspect.

This document records the project owner's engineering requirements and their interpretation for the scaffold. It is for the owner and future contributors. Product behavior is defined in [Gymtime requirements](requirements.md); supporting designs are specified in [Architecture](../ARCHITECTURE.md), [Frontend architecture](frontend.md), and [Scaffold specification](scaffold.md). The foundation, OTP, scheduling, notifications, and parent calendars are implemented. [Verification](verification.md) records local test evidence and release limits.

## Confirmed stack and workflow

| Concern | Decision |
| --- | --- |
| Repository | One repository for the frontend, backend, contracts, and project documents |
| Frontend | Lit, TypeScript, Effect, semantic HTML, and modern CSS, following the requested skills |
| Frontend tooling | pnpm and Vite |
| Backend | Rust, following the functional programming skill |
| HTTP service | Axum and Tokio |
| Database access | SQLx with the SQLite driver |
| API | JSON HTTP API with an OpenAPI contract |
| Tests | Vitest and Playwright for the frontend, plus Rust tests for the backend |
| Sign-in | One-time codes sent by email, rather than email sign-in links or passwords |
| Account access | Invitation-only; bootstrap the first organizer from deployment configuration, then let organizers invite other organizers and coaches |
| Persistence | SQLite for development, tests, and production |
| Deployment | Docker Compose on the owner's VPS |
| VPS integration | x86_64 behind the owner's existing Traefik proxy; Compose uses Traefik labels and the existing proxy network, without adding a proxy service |
| Email | Resend SDK in the Rust backend, with a configurable custom base URL and API key |
| Public site | Include a landing page |
| Search visibility | The landing page is searchable; parent team webpages and subscription feeds are excluded from search |
| Skills | Commit pinned copies of the requested skills and provide a way to discover and review upstream updates |
| Skill update checks | A manual update-check command; updates remain pinned until reviewed and applied |
| Writing | Keep project decisions in the repository and apply reader-centered writing conventions to documentation and product writing |

## Required skills

The following local repositories are the requested guidance. Read the relevant skill and its applicable references before work in that area.

| Area | Source | Project use |
| --- | --- | --- |
| Project tracking | [Beads](../.agents/skills/beads/skills/beads/SKILL.md) | Persistent tasks, dependencies, decisions requiring work, and progress through the `bd` CLI |
| TypeScript workflows | [Effect functional programming](../.agents/skills/effect-fp/SKILL.md) | Typed errors, boundary decoding, immutable domain data, injected services, and managed workflows |
| UI components | [Lit web apps](../.agents/skills/lit-web-apps/SKILL.md) | Pure Lit components, strict TypeScript, routing, rendering, and browser tests |
| CSS | [Modern CSS](../.agents/skills/modern-css/SKILL.md) | Tokens, layers, responsive layouts, themes, accessible interactions, and progressive enhancement |
| HTML | [Semantic HTML](../.agents/skills/semantic-html/SKILL.md) | Meaningful elements, native controls, labels, landmarks, reading order, and accessibility |
| Search visibility | [Google SEO](../.agents/skills/google-seo/SKILL.md) | Search behavior for routes deliberately intended for public discovery |
| Rust | [Rust functional programming](../.agents/skills/rust-fp/SKILL.md) | A pure domain crate, typed errors, boundary parsing, injected dependencies, and enforced crate boundaries |
| Writing | [Project writing conventions](writing.md) | Project documentation and user-facing writing that preserves meaning and helps its intended reader act |

These links identify copied instructions and their supporting references. `skills.lock.json` records the original repositories, commits, and file hashes. Declared licenses and attribution are retained. The semantic HTML source declares CC BY 4.0 in its README, but has no separate license file. The public repository includes seven publicly available skill copies; private guidance remains local and outside the published manifest.

## Skill copies and updates

The scaffold specification places committed copies under `.agents/skills` and records each source repository, source directory, pinned commit, release tag when available, and original entry filename in `skills.lock.json`. Preserve the semantic HTML source's `skills.md` provenance if its local entrypoint is normalized to `SKILL.md`. Copy the tracked skill material, not private or ignored source assets.

An update tool will check configured upstream repositories for new releases. Sources without releases will use new commits on the configured branch as their update signal. It will report the old and new revision and show the instruction changes before replacing a pinned copy. Applying an update must retain references and attribution and run documentation checks. A failed update must leave the previous copy usable.

The selected update mechanism is a manual command. Updates must not silently replace the project's instructions. Checking for updates reports available revisions without changing the copied files; explicitly applying a selected update produces a reviewable change and updates the manifest alongside the copied files. The mechanism must work without a scheduled workflow. Automatic update pull requests are not part of the selected first version.

## How the skills work together

The requested styled, interactive app takes precedence over the semantic HTML skill's default restriction to static pages without CSS or JavaScript. Apply its element selection and accessibility guidance within Lit templates. Use the modern CSS skill for presentation and Lit for interaction. The semantic HTML repository calls its guidance file `skills.md`, rather than `SKILL.md`.

Effect governs TypeScript services and fallible workflows. Lit governs component lifecycle, reactive properties, rendering, and DOM events. A small adapter at the application boundary will connect the managed Effect runtime to Lit's asynchronous data APIs. Domain and service code will not scatter runtime execution or introduce a second competing application state system. The adapter design is specified in the frontend architecture document.

Use Google SEO guidance to decide search behavior; semantic HTML provides the document structure. Examples in a skill do not create requirements for languages the app does not support, fixed metadata character counts, or structured data unrelated to the page's content.

The Rust backend owns authorization, confirmed bookings, approval, cancellations, swaps, and transactional conflict enforcement. Frontend checks improve the user experience, but the backend must enforce every rule again. Pure decision functions remain separate from HTTP handlers, database drivers, email delivery, and clock access.

## Repository knowledge and tracking

The [supplied harness engineering reference](references/openai-harness-engineer.md) is the basis for this workflow. Adopt its repository knowledge, enforcement, and feedback principles at the scale this project needs.

The short root [AGENTS.md](../AGENTS.md) points to product requirements, architecture, scaffold instructions, quality expectations, and the requested skills. Deeper explanations live in focused documents instead of being repeated in the root guide. Create documents as their subjects become defined; do not fill the repository with empty templates.

Beads is the only task tracker. Use it for task status, dependency ordering, blockers, and progress. Repository documents hold durable product specifications, architecture, decisions, and operating instructions. Do not maintain a second backlog or task checklist in Markdown. If a complex Beads task needs a checked-in design or execution explanation, link it from the bead and keep work status in Beads.

Beads is initialized locally, without installing hooks or replacing the custom agent guide. Run `bd prime` at session start and after context compaction. Task records are local; no remote synchronization has been configured. Beads does not grant Git authorization. Git commits, pushes, and deployment remain subject to the user's session authorization. The owner authorized the initial public GitHub release.

Product and engineering decisions must be reflected in project documents, so future work does not depend on remembering this conversation. Follow [Writing conventions](writing.md) for both new writing and revisions. For technical documentation, preserve exact names, preconditions, error behavior, and the distinction between proposed and confirmed choices.

## Scaffold choices

The core tooling below is selected by the owner. Supporting defaults are specified in the architecture and scaffold documents, with optional choices marked separately. Specified defaults are implementation design choices, not additional owner requirements.

| Concern | Choice | Status | Reason |
| --- | --- | --- | --- |
| Repository layout | `apps/web`, a Rust workspace under `crates`, and focused `docs` in the confirmed single repository | Specified in scaffold | Keep the frontend, backend, contracts, and documentation reviewable together |
| Frontend tooling | pnpm, Vite, strict TypeScript, and Lit | Selected | Follow the requested UI skills without adding a second frontend framework |
| TypeScript workflows | Effect's stable 3.x line, with compatible companion packages | Required by the requested skill | Verify and pin compatible versions during setup |
| Rust tooling | Edition 2024, an exact supported stable compiler, rustfmt, and Clippy | Required by the requested skill | Make local and CI environments consistent |
| HTTP service | Axum and Tokio | Selected | Use the Rust skill's HTTP application shape |
| Database access | SQLx's SQLite driver with versioned migrations | Selected | Use the selected database through the Rust skill's repository interfaces |
| API contract | JSON HTTP API described by a checked-in OpenAPI contract | Selected | Make Rust and TypeScript boundary shapes explicit and detect drift |
| Rendering | Client rendering for interactive routes; build-time rendering for the landing page | Specified in architecture | Fit the Lit skill's rendering modes while keeping the production business service in Rust |
| Local services | Separate local Compose setup with the application, SQLite, and a compatible test email API | Specified in scaffold | Exercise the production database and inspect email without contacting coaches |
| Background delivery | A durable SQLite outbox processed by a background task in the Rust application | Specified in architecture | Commit schedule changes independently of email endpoint availability and retry delivery safely |
| CI | GitHub Actions, if the repository is hosted on GitHub | Proposed | Run the same documented checks used locally |
| UI verification | Vitest in real browsers through Playwright, with keyboard and accessibility checks | Selected | Exercise custom elements and actual browser behavior |
| Backend verification | Unit and property tests for pure decisions; integration and concurrency tests with SQLite | Selected | Verify conflicts, permissions, swap validity, and transaction behavior using the production database |

Axum's [official documentation](https://docs.rs/axum/latest/axum/) describes its routing, extractors, and Tokio integration. SQLx documents [SQLite connection options](https://docs.rs/sqlx/latest/sqlx/sqlite/struct.SqliteConnectOptions.html), including foreign keys, journal mode, and lock waiting. PostgreSQL-specific examples in the Rust skill will be adapted to the selected SQLite database. Tests must use SQLite directly, rather than treating it as a substitute for a different production database.

Avoid copying version numbers blindly from example scaffolds. Resolve the required skill constraints against current official package documentation and the deployment environment, then pin compatible versions and commit lockfiles.

The specified rendering model does not require a JavaScript server in production. Dynamic parent team webpages load the current schedule from the Rust service; calendar subscriptions come directly from the Rust service. A future requirement to server-render live Lit components would call for a separate JavaScript rendering service and an explicit architecture change.

## Email OTP and delivery

Organizers and coaches sign in by entering a one-time code received at their email address. Email sign-in links and password authentication are not selected for the first version. Parent team links continue to work without an account.

Sign-in is invitation-only. Bootstrap the first organizer from deployment configuration, then let organizers invite other organizers and coaches. The landing page is informational and offers sign-in; it does not offer public account signup.

Use short-lived, single-use codes with a bounded number of attempts and a resend cooldown. Keep code verification and session creation on the backend. Architecture specifies the initial configurable code, rate, and session limits; implementation must test them with an injected clock.

The backend will use the Rust `resend-rs` SDK. Its [documentation](https://docs.rs/resend-rs/latest/resend_rs/index.html) supports `RESEND_API_KEY` and an override through `RESEND_BASE_URL`. Both settings belong in server configuration; secrets must not be included in frontend assets, Git, or logs. The sender address and public app URL must also be configurable.

The owner confirmed that the custom endpoint uses the same API and API-key authentication as Resend, with no extra headers or interface differences. Verify SDK compatibility, including any idempotency behavior used for retries, in integration tests. Provider-specific errors will be translated into the application's typed email errors at the infrastructure boundary. Local development and automated tests must use an isolated compatible endpoint or fake adapter rather than sending real OTPs or coach notifications.

The specified outbox stores notification delivery work in the same transaction as a confirmed schedule change. Email sending happens after commit so a slow or unavailable endpoint does not hold a booking write lock. Bounded retries and delivery records belong to the worker. The OTP delivery path must give the user a clear resend action without revealing account membership and must not replay an expired code from a delayed job.

## SQLite and VPS operation

Use a persistent volume on the VPS's local disk for the database. Container replacement must retain seasons, requests, bookings, accounts, and notification state. Include a documented consistent backup and restore procedure; backup storage and retention can be selected during deployment planning.

The architecture specifies foreign keys enabled, WAL journaling, and bounded lock waiting. SQLite [allows one write transaction at a time](https://www.sqlite.org/lang_transaction.html); its [WAL mode](https://www.sqlite.org/wal.html) allows readers and a writer to run concurrently on the same host.

For approvals, changes, and swaps, acquire a write transaction before checking current availability, then perform the conflict checks and all related updates before commit. The check must account for overlapping times and a full-gym reservation occupying both halves. Cancel competing requests and create notification work within the same transaction. Swaps must update both bookings or neither. Use schema constraints for valid references and duplicate prevention, with transactional workflow checks for time overlaps.

Concurrency tests must use separate connections to a real SQLite file and demonstrate that simultaneous conflicting approvals cannot both succeed. Use rollback tests for partially failed swaps and changes. Retrying a database lock failure must repeat the complete decision against current state, with a bounded retry policy.

Start with one application instance on the x86_64 VPS, with notification processing in that instance. Compose will provide reproducible startup, health checks, persistent storage, and configuration.

Traefik already exists on the VPS. The application service will join its Docker network and declare routing and internal service-port labels. Do not add Traefik or another reverse proxy to the project's Compose file. The hostname, proxy network, HTTPS entrypoint, and certificate resolver values will be supplied through deployment configuration to match the existing setup.

## Landing page and parent schedule search

The first version includes a public landing page. Apply the Google SEO skill to that page and other content deliberately intended for discovery.

The selected model is a shareable team link excluded from search. The alternatives below explain the distinction:

| Model | Parent experience | Search behavior | Fit with agreed scope |
| --- | --- | --- | --- |
| Public and searchable | Anyone can view a team schedule, including visitors finding it through search | Eligible to appear in results; actual indexing is not guaranteed | Not selected |
| Shared link excluded from search | Anyone with the link can view and subscribe, without an account | Use `noindex` for the webpage and an equivalent response directive for calendar feeds | Selected for the first version |
| Restricted access | Viewing requires a parent account or another access check | Authentication prevents unauthenticated crawlers from reading the schedule | Not selected; would change the agreed parent workflow |

Google documents [how `noindex` excludes content from search](https://developers.google.com/search/docs/crawling-indexing/block-indexing). It must be visible to the crawler; blocking the same URL in `robots.txt` can prevent the crawler from seeing the rule. Search exclusion does not prevent someone with the link from viewing or sharing the schedule. The selected model preserves the agreed parent experience while separating schedule sharing from marketing discovery. Team pages and feeds will not be listed in the public sitemap or landing-page links.

The architecture uses non-enumerable team sharing URLs. Organizers and a team's primary coach can replace its sharing link. The confirmation explains that the old webpage and subscription stop working, and parents must use the new link.

## Harness expectations for the scaffold

The scaffold should make the application bootable with documented commands, seed data, and isolated local configuration. Separate worktrees should be able to use their own ports and database state.

Architecture rules should become checks: Rust crate dependencies protect the pure domain; TypeScript lint and type checks protect service boundaries and Effect conventions; contract checks detect API drift; documentation checks validate local links and declared commands. Error messages should point contributors to the relevant rule and repair.

Structured logs and request tracing should let a contributor follow an action from an API request to its booking changes and notification delivery. Browser checks should exercise organizer approval, competing requests, a coach cancellation, a swap, and the parent schedule. Start with observable logs and reproducible tests; add separate metrics and trace infrastructure when a concrete requirement calls for it.

## Engineering review status

The stack and workflow questions from this review are resolved. The searchable landing page, team schedules excluded from search, invitation-only email OTP, configured first organizer, SQLite through SQLx, Axum and Tokio, pnpm and Vite, JSON HTTP API with OpenAPI, browser and Rust tests, VPS deployment through Compose and existing Traefik labels, a single repository, and committed skills with manual update checks are confirmed.

Team links work without parent accounts: anyone with a team's shared link can view its published schedule. The custom email endpoint is Resend-compatible and requires no extra headers.

Architecture, frontend behavior, and scaffold instructions are now documented. They define layout, rendering, outbox transactions, authentication defaults, screen behavior, and verification. The scaffold records the resolved toolchain and dependency choices; local verification is recorded in its specification. The first-version download design uses `.ics` files. These design choices remain reviewable alongside the owner-selected requirements.

Before deployment, supply the hostname, Traefik network, HTTPS entrypoint, certificate resolver, sender address, initial organizer email, custom email base URL, and API key through deployment configuration. Select backup storage and retention in the deployment runbook. Actual values and secrets do not need to be committed to the project documents.

The scaffold, authentication, scheduling, notification delivery, parent calendars, and role guides are implemented. Local checks and browser tests exercise their behavior. See the development and deployment guides for setup and operating procedures, and verification evidence for the limits of that testing.

## Pure calendar dependencies

Calendar arithmetic uses Chrono 0.4.45 and Chrono-TZ 0.10.4 with default features disabled and only `std` enabled. These provide pure date and timezone calculations without clock access. The injected `Clock` remains the only source of current time. Local times that fall in a DST gap or fold produce explicit errors. See the [Chrono feature reference](https://docs.rs/crate/chrono/0.4.45) and [Chrono-TZ reference](https://docs.rs/chrono-tz/0.10.4/chrono_tz/).
