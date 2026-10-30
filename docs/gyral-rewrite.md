# Gyral frontend rewrite

The owner requested Gyral `0.3.1-next.9`, initially vendored from the local release, and
conventions drawn from `sabacc-game-site` and `starwars.run-site-v2`. The October 11
update replaces those archives with the published npm `0.3.1` packages.
The owner approved replacing the frontend while retaining the Rust API and SQLite database. The application now uses Gyral components, commands, drivers, and landing-page rendering. The existing database schema and backend scheduling authority remain in place.

The audience is the owner and contributors implementing the rewrite. Product
behavior remains defined by the 27 [acceptance scenarios](requirements.md#acceptance-scenarios).
Task status and dependencies belong in Beads.

## What the review found

Gymtime already implements invitation-only sign-in, organizer and coach
permissions, recurring requests, conflicting-space approvals, changes,
cancellations, reciprocal swaps, durable notifications, and parent calendars.
The [verification record](verification.md) and [role walkthrough](workflows.md)
provide more than a scaffold to port.

| Review finding | Resulting design |
| --- | --- |
| The Rust domain/app/infra/API/server layers separate decisions, permissions, transactions, and adapters | Keeping that backend preserves the tested scheduling authority and the existing database |
| The former planner was 2,607 lines and combines view state, forms, dialogs, loading, mutations, and navigation | The [workspace model](../apps/web/src/pages/workspace/model.ts), intent parsers, and view modules separate these responsibilities |
| [Effect services](../apps/web/src/services/schedule.ts) own decoded HTTP workflows and preserve mutation identities across retries | Retain those workflows behind Gyral drivers; replacing them with untyped component fetches would lose existing behavior |
| The former Lit controllers owned native errors and event cleanup | [Form hooks](../apps/web/src/components/form-errors.ts) and [subscriptions](../apps/web/src/runtime/commands.ts) retain teardown |
| [The browser adapter](../apps/web/src/runtime/adapter.ts) centralizes runtime execution; the former shell disposed it on disconnect | The document owns runtime disposal; component removal cancels its commands |
| [The landing renderer](../apps/web/src/landing.ts) formerly used Lit SSR, while authenticated and parent pages render on the client | Gyral SSR generates the landing page at build time |
| `pnpm check` performs static and policy checks; `pnpm run ci` adds tests, builds, and Docker | Adopt the references' complete verification gate deliberately; running the current `check` alone does not demonstrate browser behavior |
| The architecture introduction still described the app as unbuilt | Correct that statement and distinguish implemented behavior from the proposed Gyral design |

These are migration findings, not a claim that a comprehensive security audit
has been performed. Existing evidence does not establish production deployment,
live email delivery, or real calendar-client refresh behavior.

## Conventions to adopt

The references demonstrate complementary uses of Gyral. Sabacc combines
Model-View-Intent components with pure Effect logic and custom drivers.
starwars.run uses Gyral server templates and interactive islands. Gymtime needs
the interactive application conventions and a readable public landing page.

| Concern | Gymtime direction |
| --- | --- |
| Rendering | Gyral's own `html`, `css`, `each`, and `define<State, Msg>()(tag, spec)`; no Lit renderer in migrated components |
| State and effects | Tagged messages, pure intent/update/view flow, commands as data, and Effect workflows behind injected drivers |
| Toolchain | Strict TypeScript, Vite 8, Vitest 4, Playwright, and pnpm; retain existing compatible pins until a specific migration requires changing them |
| Templates | Gyral Vite plugin (`gyral()`), recommended Gyral ESLint rules, generated element types via `gyral-types`, and compiler checks |
| Accessibility | Native forms and dialogs, visible errors, keyboard and focus behavior, light DOM for page landmarks, responsive CSS, and reduced motion |
| Tracking | Beads alone; keep its local data excluded from Git and retain the current session's Git authorization |
| Repository knowledge | Short AGENTS.md navigation, focused requirements and designs, pinned references, executable boundaries, and recorded verification limits |
| Builds | Exact npm release pins and lockfile integrity hashes, frozen dependency installs, multiple Docker build stages, non-root runtime, health checks, and persistent SQLite |
| CI | Preserve Gymtime's local verification policy; the two references have different trigger policies, so neither grants authorization to enable hosted runs here |
| Publication | Keep deployment, registry pushes, and Git publication subject to the current user authorization |

Do not copy site-specific choices such as Three.js, DuckDB, an archive ingest
pipeline, or a Caddy service into this scheduling app. Gyral does not require
them. Gymtime's existing external Traefik integration remains relevant.

## Implemented architecture

Keep the existing API contract, SQLite migrations, opaque session cookie, CSRF
validation, server permissions, parent projection, calendar identities, and
notification transactions. Gyral changes the browser rendering and state model.
Rust continues checking and writing conflicting bookings within one immediate
SQLite write transaction.

The browser entry creates one scoped Effect runtime, provides Gyral drivers,
and owns disposal. Domain and transport schemas remain independent of Gyral.
Services compose Effect workflows. Drivers translate commands into those
workflows and translate their results into typed messages, passing through
Gyral's cancellation signal. Components return commands and render state.

The planner is split into calendar navigation, time selection and review, requests,
history, swaps, sharing, setup, people, notifications, and help. Each component owns its local state. Session and shared schedule state have one explicit owner;
the workspace reducer owns its schedule.

Read commands use `switch` where the latest selection wins, with response
identity checks where necessary. Mutation commands use `exhaust` to prevent
duplicate submissions. Generate one idempotency key for each submitted action
and retain it after a committed write whose reload fails. Aborting a browser
request does not prove that its server transaction did not commit.

Preserve selection and form drafts across filtering, disclosures, schedule
refresh, and confirmation. Form intents parse native input at the boundary;
reducers receive typed messages. Replace Lit event closures with `data-intent`,
form property bindings with Gyral's live form attributes, and keyed lists with
pure `each` rows. Native dialog focus and error associations need real-browser
checks alongside model tests.

Generate the landing page at build time with `@gyral/ssr`. Keep the initial
workspace and parent pages client-rendered unless request-time rendering has a
separate product reason. Choose the Vite plugin's hydration setting (`clientOnly`) based on
whether component markup is actually server-rendered; a static landing template
does not itself require hydrating the authenticated workspace.

Never seed a parent page with the authenticated schedule and hide fields in the
view. Gyral's server-rendered state is serialized into HTML, so parent pages must
receive only the public allowlist. Do not put sign-in codes, bearer credentials,
or other secrets in component state or hydration seeds. Keep team tokens out of
public sitemap entries and preserve search exclusion headers.

A full Node/TypeScript backend rewrite is a distinct scope. It would also need
to port authentication cryptography, transaction ownership, migration and
restore compatibility, idempotency receipts, outbox leasing/retry, timezone and
calendar encoding, and the Rust property/integration tests. Choosing Gyral alone
does not require replacing these tested mechanisms.

## Release packages

Core, SSR, and testing are pinned to the published npm `0.3.8` release. SSR and
testing take that exact core version as a peer, so no local override is needed. The
lockfile records registry integrity hashes. All nine earlier prerelease archives
and their vendor metadata have been removed; Docker copies no vendor directory.
The [dated verification](verification.md) retains the earlier archive evidence.

Use exact versions for the packages actually used, keep Gyral packages on the
same release, and verify a frozen install. Read the matching `@gyral/mcp@0.3.8`
corpus and [migration guidance](https://github.com/gyraljs/gyral/blob/v0.3.8/docs/references/migrating-0.3.7-to-0.3.8.md)
for framework APIs. Do not infer them from Lit or earlier prereleases.

## Verification boundary

Preserve the existing requirement tests and run them against the replacement UI.
Add DOM-free Gyral model tests for new transitions and driver commands. Keep real
Chromium and WebKit component tests, full-stack Playwright with fresh SQLite and
the email sandbox, contract drift checks, Rust transaction tests, architecture
checks, accessibility checks, native builds, and the Linux amd64 container build.

The migration is complete when all accepted role workflows use Gyral, production
installs use the exact published release, the complete verification gate passes,
and repository documents describe the resulting architecture. Removing Lit also
requires removing its controllers, signal/context/task packages, decorators,
analyzer, lint rules, SSR imports, and old browser test helpers together.
