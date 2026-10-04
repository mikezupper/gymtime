# Verification

## Public release preparation — October 4, 2026

The public release preparation passed `pnpm check`, twelve Vitest unit tests, 43 Rust tests, eighteen browser-component cases, sixteen full-stack browser cases, and the native build. Documentation checking covered 22 files and 135 local links. All seven published skill pins passed hash verification. Online update discovery also worked without applying an update.

The production Docker image built for Linux x86_64. A disposable local container passed readiness, served the landing page with its configured canonical origin, excluded the workspace from search, and ran as UID 10001. This smoke check used fictional configuration and no live email delivery. It is not evidence of VPS deployment or proxy integration.

The staged public tree passed Gitleaks with no findings. Local databases, authentication captures, credentials, Beads records, private guidance, and generated browser artifacts are excluded. Public source starts from a clean root commit rather than the earlier local tracker history. GitHub Actions configuration passed Actionlint. These checks reduce publication risk; they do not certify the application against every vulnerability.

Verified on October 2–4, 2026, on Linux x86_64. This record covers the implemented first version in [Requirements](requirements.md), including the [role walkthrough](workflows.md). Browser and email-provider limits are stated below.

## Application checks

| Check | Observed result |
| --- | --- |
| Frozen dependency installation | Passed with Node 24.21.0 and pnpm 12.8.2; container installs use the frozen lockfile |
| `pnpm check` | TypeScript, ESLint, strict Lit templates, rustfmt, Clippy, dependency audit, pure-domain build, architecture boundaries, contract drift, migration documentation, document links, configuration names, and all published skill hashes passed |
| `pnpm test:unit` | Twelve Vitest tests and 43 Rust nextest tests passed; the doctest command passed with no doctests present |
| `pnpm test:browser` | Eighteen cases passed across Chromium and WebKit: calendar occupancy, assistant capabilities, status updates, field errors, listener cleanup, saved setup progress, mixed-role guides, browser preference decoding, and first-season selection without refresh |
| `pnpm test:e2e` | All sixteen cases passed across Chromium and WebKit after onboarding and help; the October 4 regression run reported 1.0 minute |
| `pnpm build` | Contract export and generation, landing generation, frontend assets, and Rust binary build passed |
| Targeted mutation tests | 84 mutations: 72 caught, 11 did not compile, and one behavior-equivalent survivor described below |

The end-to-end browser tests use real Rust, fresh SQLite files, and an isolated Resend-compatible email sandbox. They cover invitations and email-code sign-in, missing CSRF and invalid Origin, account permissions, setup and slot previews, a coach request and organizer approval, competing full-gym/half-gym requests, assistant restrictions, reciprocal swaps, whole-gym closure previews, notification inboxes, parent privacy, stable calendar identities, and cancellation revisions. Landing checks cover HTML without JavaScript, search directives, missing-resource status, keyboard navigation, dark mode, narrow viewports, and automated accessibility checks.

Earlier browser runs exposed waits that began before sign-in delivery or verification had completed. The tests now wait for the code form and app navigation, and use two workers against the shared temporary service. The final full run passed without retries. Component checks also verify that corrected field errors stay cleared across unrelated renders.

## Requirement coverage

| Acceptance scenarios | Evidence |
| --- | --- |
| 1, 17, 18: gym setup, equal organizers, draft/active/closed seasons | Real-SQLite setup, permission, and notification tests; organizer browser setup |
| 2–5, 12, 21: physical conflicts, visible requests, competing reasons, multiple teams, coach-overlap warnings | Domain overlap properties; SQLite approval and assignment tests; competing-request browser flow |
| 6, 7, 9: assistant permissions, immediate release, closures | SQLite permission/cancellation/closure tests; assistant and closure browser flow |
| 8, 20, 23: reciprocal exchange, invalidation, withdrawal, expiry | SQLite swap tests, including failure on the second booking write; both-browser acceptance flow |
| 10, 13, 25: team-only parent views, private-note exclusion, search policy | Dedicated public projection tests; anonymous webpage and feed browser checks; landing metadata checks |
| 11, 15, 16, 19, 22: history, recurring partial decisions, changes, pending edits and withdrawals | SQLite recurring workflow and closed-season tests; scope and affected-date UI controls |
| 14, 24: immediate routing and grouped notifications | Atomic notification writes, recipient/grouping tests, outbox tests, and inbox browser checks |
| 26, 27: invitation-only OTP and first-organizer bootstrap | OTP properties, race/expiry/permission tests, restart tests, and both-browser sign-in/invitation flows |

SQLite tests use real temporary files and multiple pooled connections. Simultaneous conflicting approvals commit at most one booking. Injected database-trigger failures prove that team setup, slot creation, invitation delivery, approval notices, and both sides of a swap roll back together. Idempotency receipts reject a reused key with different input and recheck current permissions before replay. Recurring changes preserve event identities and completed dates; rotating a team capability invalidates the old public link without changing booking identities.

Notification tests prove recipient deduplication, grouping across recurring dates and multiple team assignments, assistant delivery, active-season availability notices, inbox ownership, bounded retries, stale-lease protection, crash recovery, and organizer-only retry after exhaustion. Manual retry keeps the same notification and delivery identity. OTP plaintext is excluded from the durable notification outbox.

The email SDK integration test checks a custom base-URL path prefix, bearer authentication, sender/recipient fields, payload format, transient retry with the same key, rejected requests, and malformed success responses. No real email was sent.

## Mutation review

Mutation testing ran in temporary copies, targeting session/challenge usability, timezone resolution, date ranges, opening hours, slot requestability, and calendar escaping/encoding/folding. It identified missing assertions for the full seven-day idle window, non-hour time round trips, dates and hours outside both boundaries, long ASCII calendar lines, unsplit gyms, and exact completion boundaries. Those assertions now pass and catch the corresponding changes.

The one survivor changes the folding threshold from `> 75` to `>= 75` octets. It folds some lines earlier while preserving UTF-8, unfolded content, and the maximum line length required by [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545#section-3.1). It is classified as equivalent rather than defeated with a test demanding an arbitrary folding position. This is targeted coverage, not mutation coverage of every workflow.

## Engineering review

Rust and Effect self-review references were applied. Mechanical sweeps found no unchecked production unwraps, panics, primitive casts, driver errors in the domain/app, ambient domain clock/random reads, or runtime execution outside the browser adapter. Test expectations state their invariants. SQLx guards roll back on errors, cancellation, and dropped writes. Dynamic ports use `async_trait`; infrastructure translates driver and SDK failures into named errors.

The pure domain uses `thiserror` and clock-free Chrono/Chrono-TZ features for deterministic calendar calculations. Architecture checks reject their default features and I/O dependencies. The app owns permissions and transactions; only the server wires adapters. Schedule reads obtain current permissions and data together, and mutation replay rechecks authorization.

Frontend transport schemas deliberately retain JSON nulls and numeric IDs. Rust validates command values and owns business decisions. Lit Task Promise boundaries are framework interop; Effect owns HTTP workflows, typed failures, cancellation, bounded transient retry with jitter, and workflow spans. Retry tests inject HTTP, key generation, and a test clock. Native forms, dialogs, error descriptions, and lifecycle controllers preserve browser semantics. Pinned instructions remain unchanged; project interpretations live in [Engineering decisions](engineering.md) and [Frontend architecture](frontend.md).

## Runtime and release limits

The earlier foundation checks verified coordinated development shutdown and failed startup cleanup, amd64 runtime UID 10001 without Node, independent local Compose, external Traefik labels without a proxy service, container replacement, consistent backup/restore, organizer preservation, and copied-skill update rollback. The final product image `sha256:954079d6362d7f2e4e63c3385183eab680281f0228c3a35b73a2732b2add67aa` built for amd64 and passed readiness. It runs as UID/GID 10001 without Node. Production Compose validated with the example routing values and contains only the app service; local Compose also validated.

Container replacement preserved all counts. A stopped-writer directory backup restored into separate storage, passed readiness and SQLite integrity, and matched complete row fingerprints for accounts, organizer grants, seasons, teams, slots, bookings, requests, swaps, closures, notifications, and migration records. The restored public JSON and cancellation feed worked. These checks used a deliberately unreachable loopback email endpoint, so no external delivery occurred. Test containers were removed; ignored inspection data remains locally.

The owner's native preview runs at `http://localhost:5177`, with API port 3017 and the email sandbox at `http://localhost:8027/messages`. The existing configured organizer was preserved while migration 0004 applied. Sign-in worked through the UI; desktop and mobile dark screenshots were visually inspected, with no page errors or horizontal overflow at 390 pixels or 200% zoom. The owner's database now contains the [example mock season](workflows.md#example-mock-season), populated through authenticated scheduling APIs. Its six teams have recurring practices and Saturday games, with examples of pending and decided requests, changes, coach cancellations, swaps, and school closures.

The October 3 mock-data check found 692 published slots, 282 confirmed bookings, 39 cancelled bookings, 11 pending requests, five swap states, and five closures. Confirmed bookings had no physical overlaps or conflicts with active closures. All six anonymous parent projections and feeds matched their teams' published bookings, retained cancellation records, excluded internal notes and pending requests, and returned search exclusions. The local email queue reported no failed jobs.

The mock season exposed a missing Vite proxy for `/calendars`; development now forwards those feeds to Rust. It also exposed costly closed booking editors. Creating organizer move and coach swap forms on first expansion reduced the measured Chromium organizer load from 24.3 seconds to 1.6 seconds with the same season. These are local observations, not a production performance guarantee. Both-browser end-to-end checks verify deferred form creation, draft selection retained through collapse and schedule refresh, and swap submission. The populated organizer, receiving coach, and parent screens passed a separate Chromium walkthrough without page errors. `pnpm check` and `pnpm test:unit` passed after the changes. These preview refinements have not been rebuilt into the previously tested container image above.

A setup-screen accessibility check found transient contrast failures during tab background transitions. Removing that transition fixed the issue, and the organizer setup screen is now included in both-browser axe checks. The connection-status browser test scopes its status assertion to the connection panel, because schedule loading also has a status region.

An actual iPhone or another calendar subscription client has not been tested. The feed uses stable UIDs, increasing sequences, UTC times, cancellation records, proper escaping, and UTF-8 line folding; each calendar client controls refresh timing. Firefox is not in the configured automated suite. The owner's custom live email endpoint and VPS remain untested here. There has been no Git commit, push, external email, or VPS deployment.

## October 3 UX redesign

The owner-approved [audit](ux-audit.md) is implemented. The full-stack tests now include a primary coach assigned to two teams, persistent selection across team switches, multiple weekly patterns, an explicitly excluded booked date, mobile review with keyboard focus return, draft notes retained after closing review and returning from confirmation, partial approval/decline, mixed-outcome history, and anonymous parent privacy. Both Chromium and WebKit passed. Existing invitation, scheduling, cancellation, swap, closure, and subscription checks also pass through the redesigned interface.

Four new pure-view tests cover physical competition grouping, compatible halves, separate change intents on the same original series, mixed decisions, and multiple recurring patterns. A property test runs 150 generated request sets with a fixed seed, proving that grouping preserves each request exactly once and is independent of input order. Four additional browser cases verify actual half-gym occupancy, compatible availability, exclusion of cancelled history, and assistant viewing capabilities.

A separate read-only Chromium walkthrough used the unchanged school database at 1440 × 1000 and 390 × 844. The folded request view showed five review items for eleven pending requests and measured about 1,075 pixels on desktop and 1,400 on mobile, versus the audit's 21,664 and 62,192 pixels. The weekly calendar measured about 1,150 pixels on desktop and no longer included the 321-booking season history. These are fixture measurements, not user task-completion estimates. Expanded details naturally increase page length.

Organizer and coach calendar, queue, competition, finder, recurrence, mobile review, Saturday agenda, and mobile dark-theme inspections reported no page errors, horizontal overflow, or axe violations. A further interaction check confirmed that incompatible bulk approval is disabled, single approval previews name the competing cancellation, Escape returns focus, closure reasons open from unavailable calendar entries, administration passes axe, and 200% zoom causes no document overflow. Ignored screenshots and inspection evidence are under `.local/ux-redesign`. All six parent feeds and projections still match their team's events, omit private fields, and retain search exclusions; the owner database still has 282 confirmed bookings and no physical conflicts. No mock booking or request was changed by these walkthroughs.

The frontend remains a Lit presentation layer over the existing Effect adapter and Rust mutations; no scheduling schema, authorization rule, or backend transaction changed. TypeScript, strict templates, architecture, Rust checks, skill hashes, and document links pass. The native build passes. The previously tested Docker image predates this redesign; no new image, VPS deployment, real email delivery, or calendar-client refresh is claimed. Real coaches' first attempts remain the next usability check.


## October 4 onboarding and help

The owner-approved [onboarding design](onboarding-and-help.md) is implemented. Both browser engines passed setup acknowledgment persistence, opening the selected season's team form with keyboard focus, reviewing saved setup, keyboard activation and Escape dismissal of help, primary/assistant assignments on the same coach account, and the optional request walkthrough without creating requests. Dismissal survives a reload and Help reopens the guide. Mobile coach guidance and parent subscription instructions pass axe; parent guidance also passes in dark mode. Component tests verify that opening a step never completes it, acknowledgments stay season-scoped, stored values are decoded, and account preferences remain separate.

A separate Chromium walkthrough used a new SQLite database and the local email sandbox. It completed all seven organizer steps through the interface: opening hours, first season, team invitation, no-closures acknowledgment, recurring-slot preview, activation, and sharing acknowledgment. Reloading midway retained progress. This exposed and corrected stale workspace selection after creating the first season; a component regression test now covers selection without reloading. Saved actions also initialize the first eligible team. Six fresh-instance screenshots cover desktop, resumed setup, completed setup, mobile, dark mode, and parent guidance, with no page errors, document overflow, or axe violations.

A further read-only school walkthrough checked desktop and mobile Help, saved setup summary, dark mode, and a mobile help popover. All four views passed the same checks. Ignored scripts and screenshots are under `.local/onboarding-review`. The owner's database still has 282 confirmed bookings, eleven pending requests, and no physical booking conflicts; all six parent feeds match their team events and omit private fields. No owner booking, request, or closure was changed.

The final root check, twelve Vitest unit tests, 43 Rust tests, eighteen browser-component cases, and sixteen end-to-end cases passed. Strict Lit checks covered 36 files. Browser dependencies used by the new planner regression are explicitly preoptimized to prevent a test reload. Help preferences use schema-validated browser storage through the existing Effect adapter; there are no backend or schema changes. Manual acknowledgments are local to the account and browser, as documented in the guide. No VPS deployment, updated Docker image, real email delivery, live calendar-provider refresh, or user usability study is claimed.
