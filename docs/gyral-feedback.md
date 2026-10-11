# Gyral feedback from Gymtime

For the owner and Gyral maintainers. Reviewed October 11, 2026, using the
published npm `0.3.1` core, SSR, and testing packages. The
[verification record](verification.md) lists the checks and their limits.

## Application and integration

Gymtime schedules one basketball gym. Its thirteen Gyral components cover
invitation-only sign-in, organizer setup, coach requests, booking review,
notifications, help, and parent calendars. Rust owns permissions, scheduling
mutations, SQLite transactions, and email delivery. Effect supplies decoded
browser workflows through named Gyral drivers and one managed runtime.

The landing page is rendered at build time with `@gyral/ssr`; Rust serves that
HTML. Workspace and parent components render in the browser. The Vite preset
uses `clientOnly: true` because no component markup requires hydration. This
application does not exercise request-time component SSR or hydration.

## What works for this application

- **Reducers and commands can be tested without a browser.** `step()` and
  `inputsFor()` cover draft retention, stale responses, duplicate-write
  suppression, and mutation-key reuse. A seeded property test checks compatible
  selection across 100 generated toggle sequences.
- **Driver tokens preserve the existing Effect boundary.** The entry point
  supplies implementations through `provideDrivers()`. Commands select lanes
  and concurrency policies; the adapter receives Gyral's cancellation signal.
  A cancelled browser request is still not proof that Rust rolled back a write.
- **Typed child outputs and native controls fit scheduling forms.** Browser
  checks exercise canonical outputs, combined field errors, correction, and
  subscription teardown. Model-owned values preserve drafts through disclosures
  and confirmation. Native dialog and keyboard behavior remains browser-tested.
- **The compiler and lint rules agree with this frontend.** Element declarations,
  template lint, production template compilation, and landing generation are
  part of the existing verification gate. No application API edit was needed to
  move from next.9 to stable `0.3.1`.

## Distribution concern resolved

Core, SSR, and testing install from npm at exact `0.3.1` versions. Their graph
resolves one core release without the former workspace override. Registry
integrity hashes are recorded in the frozen lockfile. The nine prerelease
archives, vendor metadata, Docker copy/checksum steps, and `vendor:check` command
have been removed. Older archive results in the verification record are dated
history.

pnpm's release-age exception names only these owner-approved Gyral versions;
other releases retain the existing age gate. No broader dependency update is
included in this migration.

## Documentation suggestions

An end-to-end recipe combining a Rust API, a generated HTML landing page,
browser-only Gyral components, and an Effect driver adapter would help apps
with an existing backend. The APIs already support this design. The recipe
could show cancellation, runtime disposal, server-owned CSRF and field errors,
and the choice of `clientOnly` when there is no component hydration.

Parent calendars also demonstrate why public DTOs need a separate allowlist:
internal notes and pending requests must be omitted before rendering. This is
an application boundary, not a framework defect or a reason to hide private
fields in a view.

These are documentation suggestions. This report identifies no new Gyral
runtime defect from the stable migration's recorded checks. It makes no
framework-only size or performance comparison, and does not establish Firefox,
real calendar subscriptions, live email delivery, or production deployment.
