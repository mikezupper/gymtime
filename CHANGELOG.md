# Changelog

## Unreleased

Verification now runs locally through `pnpm run ci`, including the production container build. GitHub Actions and automatic dependency-update PR creation are disabled; security alerts and secret-scanning protection remain enabled.

Resend is updated to 0.33.0, ipnet to 2.12.2, Tower HTTP to 0.7.1, and getrandom to 0.4.3 after local verification. The selected Effect 3, Vitest 4, Node 24, and compatible SHA-2/HMAC baseline remains in place.

## 0.1.0 — Initial public preview

Gymtime provides invitation-only email-code sign-in, one-gym season planning, full- and half-gym availability, coach requests, organizer decisions, booking changes, cancellations, and reciprocal swaps. Recurring actions support occurrence-level review, and committed changes queue email notifications.

The Lit workspace includes a calendar, a time finder, grouped request review, history, role guides, and contextual help. Parents can view a team webpage and subscribe to an iCalendar feed without creating an account.

This preview includes a Rust/SQLite backend, generated API contracts, native development tools, Docker Compose deployment behind an existing Traefik proxy, and public contributor documentation. It supports one gym per database; separate schools need separate instances. Production email delivery and calendar-provider refresh behavior require validation in the deployment environment.
