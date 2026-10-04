# Gymtime Frontend Architecture

Gymtime uses Lit for rendering and Effect for TypeScript workflows. Components present validated data and emit user actions; services handle network requests and decoding. The Rust backend remains authoritative for permissions and scheduling decisions.

This document specifies the first version's frontend. It complements [Architecture](../ARCHITECTURE.md) and [Scaffold specification](scaffold.md). It describes the implemented interface; [verification](verification.md) records the checks and their limits.

The owner approved the October 3 [UX audit](ux-audit.md). The implemented redesign separates pending review, current occupancy, time selection, and history without changing the scheduling rules.

The owner also approved [onboarding and contextual help](onboarding-and-help.md). `gymtime-guide` renders permission-aware guidance and a checklist derived from saved schedule data. Its events request navigation or personal preference changes; it does not submit scheduling actions. `gymtime-help-tip` uses native popovers with keyboard and touch activation. Shared help text and checklist decisions live in `domain/guidance.ts`; the parent guide receives only a public subscription URL.

Welcome dismissal and manual closure/sharing acknowledgments use a schema-validated local storage service, injected into the existing Effect runtime adapter. They are personal browser preferences, not synchronized organizer progress. Storage failure is visible and does not disable guidance. Saved schedule actions refresh the workspace's season and team selections immediately, including when the first season is created.

## Rendering and routes

The landing page is generated at build time with Lit's server rendering tools, using ordinary document markup for its content. Its text, headings, links, and sign-in navigation work without JavaScript. It does not fetch account or schedule data during generation. Rust serves the resulting HTML in production, so no JavaScript rendering service is required.

Sign-in, the authenticated application, and public team schedules use client rendering. Their client entry imports component definitions without Lit's hydration support. Do not hide prerendered landing content behind an undefined custom element. The landing page and interactive application have separate document entries and asset requirements.

| Route | Content | Rendering and search |
| --- | --- | --- |
| `/` | Product explanation and sign-in action | Generated HTML; eligible for indexing |
| `/sign-in` | Email and OTP forms | Client rendered; excluded from search |
| `/app/*` | Gym calendar, requests, team schedules, notifications, and organizer administration | Client rendered; authenticated data; excluded from search |
| `/teams/{token}` | One team's published schedule and calendar links | Client rendered; no account; excluded from search |

The router supports ordinary links, back and forward navigation, direct entry, and a visible missing-page state. Start with the History API and a small typed route parser; use newer navigation APIs only as enhancements. Rust recognizes supported document routes rather than returning the app shell for every unknown URL. Missing API routes and assets return their actual error status. Team documents carry search exclusion before JavaScript runs.

Local Vite development proxies API calls, health checks, and calendar feeds to Rust. The deployed frontend calls same-origin routes and uses cookies; it does not receive the Resend key, auth secret, or database configuration.

## Modules and imports

| Module | Responsibility | Boundaries |
| --- | --- | --- |
| `domain/` | Validated frontend identifiers, immutable models, display decisions, tagged errors | No DOM, HTTP, or runtime execution |
| `services/` | Effect service interfaces and typed workflows | Depends on domain; no component imports |
| `infra/` | HTTP, boundary schemas, browser storage where needed, and test/live layers | Implements services; converts external failures into named errors |
| `runtime/` | Layer composition and the Lit adapter | The only application runtime execution boundary |
| `state/` | Shared signals and stable context definitions | No hidden requests or runtime execution |
| `pages/` | Route orchestration, Tasks, and user action handling | Consumes the adapter and state |
| `components/` | Presentational custom elements | Properties in, typed events out; no service or runtime access |
| `styles/` | Tokens, global foundations, themes, and shared component style modules | Static style definitions; validated calendar data supplies grid positions and counts |

Generated transport types live in the contracts workspace package. They describe wire data; they do not bypass runtime decoding. Effect Schema decodes network responses once at the HTTP boundary. Native forms provide strings and constrained options; Rust parses and validates every command. Generated wire types retain transport numbers and nullable fields. Display helpers use these immutable, validated DTOs; they do not grant permissions or cast JSON into domain types.

Use tagged unions for workflow states. DTOs retain JSON nulls for transport compatibility; local Lit state uses optional fields required by its lifecycle. New business models should use `Option` for meaningful absence. Lit or browser APIs may require optional framework fields, but those fields must be resolved at the adapter boundary before they become domain inputs. Application code follows the Effect skill's restrictions on `async/await`, `try/catch`, `throw`, `any`, non-null assertions, and untyped errors. Third-party Promise or throwing APIs are wrapped once at the infrastructure edge.

## One runtime, one source of state

Create one `ManagedRuntime` for the browser application. A stable adapter exposes typed queries and commands to pages through Lit context. Context is dependency delivery; it is not a second implementation of Effect services. All network capabilities remain Effect services provided by layers.

The adapter runs a workflow as an `Either` result so expected failures remain values. Its Promise result can be consumed by `@lit/task` without adding `async` functions to page components. Pass the Task's abort signal into runtime execution, propagate cancellation to HTTP, and dispose of resources when the application is torn down. An unexpected defect is logged with a safe reference and rendered as a generic failure; it is not converted into a successful empty schedule.

Use `@lit/task` for data owned by one route or component. It manages loading, the latest query result, cancellation, and manual submission. Render initial, loading, success, expected error, and unexpected failure explicitly. A failed request must preserve entered form data and offer the appropriate retry or correction.

Use the lowest necessary level of state:

- Component reactive properties hold local inputs and disclosure state.
- Tasks hold page-owned request results.
- Context provides the adapter, session capabilities, and stable shared-state references.
- `@lit-labs/signals` holds route state shared by the shell. Session queries and calendar filters belong to their page Tasks and reactive fields.

Calendar buttons open one booking's details in a native dialog. Move and swap forms are created when their disclosure first opens, then kept mounted to preserve choices across collapse and schedule refresh. Move and pending-request editors filter slots by a chosen date. Calendar rendering never mounts the season's booking history or its editing forms.

Each value has one owner. Do not keep the same schedule in a signal store and an Effect `SubscriptionRef`, or synchronize duplicate page and global caches. Derived views are pure computed values. Replace arrays and records immutably, and update shared state after confirmed responses. Show pending server operations explicitly; do not display an unapproved request as a confirmed booking.

Use `SignalWatcher` initially. Import signal primitives through `@lit-labs/signals`, with exactly one transitive `signal-polyfill` installation. Do not add a direct polyfill dependency or start watcher loops for ordinary rendering.

The authenticated session is represented by a server response, not a browser-stored bearer token. Signing out clears session-owned state. Pages revalidate relevant data after mutations and when returning to the application; live push updates are not required for the first version.

## Components and styling

Name elements with the `gymtime-` prefix, one element per file. Declare property and event types, and document events that cross component boundaries. Application events bubble and cross shadow boundaries. A parent never reaches into a child's shadow root.

Use Lit experimental decorators with `experimentalDecorators: true` and `useDefineForClassFields: false`. Keep TypeScript's `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` enabled. Pure derived component values belong in getters or `willUpdate`; rendering must not perform requests, mutate shared state, or dispatch actions.

Use native links for navigation, buttons for actions, labeled form controls, fieldsets for related inputs, and headings and landmarks in document order. Custom elements organize those elements; they do not replace their semantics. A weekly visual grid also has a usable chronological list. Calendar cells expose team, time, space, and status in text, including pending or competing requests. Color is an additional cue.

Global CSS defines layers, tokens, typography, and document foundations. Shadow-root component styles use static Lit style definitions and inherited custom properties. Global layer rules do not automatically style shadow contents. Components expose documented parts when callers need presentation hooks. Use container queries where component layout depends on available space, logical properties, visible focus, and reduced-motion preferences.

Support light and dark themes through tokens, starting from system preference with an optional local preference. Preserve readable contrast and native control behavior. Scope any loading visibility guard to the client-rendered root so it cannot conceal the landing page.

## Screen behavior

The desktop calendar presents a week with gym spaces; small screens default to a chronological list with date, team, time, space, and status. Users can change the date range and filter by team or space. Filters do not change permission to inspect scheduling information.

Primary coaches can request existing slots, explain a competing request, select recurring occurrences, withdraw requests, cancel approved dates, propose changes, and propose or accept swaps. Assistant coaches receive the same scheduling information with viewing controls. Organizers can publish slots and closures, decide requests, and manage seasons and assignments.

Before a bulk action, show the affected dates and distinguish dates that can proceed from conflicts or missing slots. Before a closure, show the bookings it will cancel. A cancellation explains that the slot becomes requestable immediately. A swap shows both teams, times, and spaces, the acceptance deadline, and that acceptance completes the exchange. Backend responses decide the actual outcome.

Forms associate errors with their controls. Submission state disables duplicate actions without trapping focus. Dialogs manage initial focus, dismissal, and focus return. Completion and failure messages are announced without repeatedly reading the entire calendar. Keyboard use must cover date navigation, requesting a slot, approval, cancellation, and accepting a swap.

Parents see their team's confirmed activities, gym timezone, webpage link, and subscription/download actions. They do not receive internal notes, account details, competing reasons, or pending requests in HTML, JSON, or calendar files. Search exclusion and data projection are backend policies as well as UI behavior.

## Verification

Use Vitest 4 for pure frontend tests and browser component tests. The selected Effect 3 `@effect/vitest` integration targets Vitest 3, so it is excluded. Workflow tests use a scoped test runtime with injected HTTP and retry-key services under the same Vitest version; each test releases its runtime. This preserves testable Effect workflows without installing incompatible test runners.

Browser component tests use the matching Vitest Playwright provider. Await Lit updates and assert visible output and native control behavior. Full-stack Playwright tests use Rust, temporary SQLite state, and an isolated email adapter. They cover direct routes, permission changes, schedule mutations, parent projections, and calendar responses. The configured checks run Chromium and WebKit with two workers against one temporary SQLite service. Firefox and real calendar clients are additional release checks, not claimed coverage.

Check templates with Lit tooling in addition to TypeScript. Enforce the import boundaries, Effect runtime boundary, prohibited application constructs, and single signal polyfill. Accessibility checks combine automated checks with keyboard and focus assertions. Browser automation does not prove that an actual iPhone subscription refreshes correctly; that needs a release check on a calendar client.

The planner has Calendar, Find time, Requests, History, Swaps, Parent links, and Notifications views. Organizer administration contains Gym setup and People. Native confirmation dialogs show affected dates; field-error and revalidation controllers own their event listeners and clean up on disconnect. Scheduling retries reuse a mutation key, including after a successful write followed by a failed reload. Returning to the workspace or team webpage triggers a refresh; calendar subscribers refresh on their client's schedule.

## Scheduling workspace

Organizers default to All gym. Coaches and assistants default to My teams, including every team where they are primary or assistant; a team switch and All gym remain available. Only primary coaches and organizers receive scheduling actions. The backend checks those permissions again. One active season can receive bookings; switching seasons clears the selection and resets its team context.

The calendar uses aligned minute rows and two space lanes. A full-gym booking spans both lanes; each confirmed booking appears once in the visible view. Published availability is separate from occupancy. Unavailable entries open their slot and closure details. Equivalent full/half availability choices use a single full-gym calendar entry; Find time exposes each published alternative. Day and chronological List views are available on desktop. Narrow layouts use a selected-day agenda and date strip. Weeks with afternoon practices and morning games initially show afternoon hours, with an explicit earlier-times notice and Show all hours action. Day view uses that day's published hours. Native buttons expose date, time, team, space, activity, and status without claiming ARIA grid behavior.

Find time filters published, available slots by team, date range, and gym space. Selecting another physical alternative replaces an overlapping selection. Selections persist across filter and date changes; the desktop review panel and mobile Review selection bar keep the next action visible. A native review dialog supports mobile submission and returns focus to its trigger. The activity, note, competing reason, and change scope share one draft across desktop and mobile review, including closing the panel or returning from confirmation. The chosen team receives every selected date. Repeat weekly expands each distinct weekday/time/space pattern through an end date, deduplicates matches, and lists missing or unavailable dates. The finder displays the first fourteen matching days and explains how to reach later dates.

Requests defaults to pending work, sorted by first affected date. Recurring dates group by team, series, new/change type, activity, note, and reason. These intent fields distinguish separate change proposals that reuse an original booking series. Physical competitions connect related rows into a comparison group; compatible halves stay separate unless linked by a full-gym competitor. The queue shows both group and occurrence counts. Team, type, affected-date, and competing filters sit in a disclosure. Selections survive filtering; approval is disabled when selected requests physically compete. Confirmation lists selected dates and named competing cancellations. Changes show the original confirmed time beside the requested replacement.

History paginates twenty bookings or completed request groups, with search and status filters. A request group retains all its completed outcomes when a filter matches one date, so mixed approvals and declines remain visible. Pending and completed swaps have separate views. Notifications paginate twenty messages and disclose message bodies; organizer audit history is secondary. Parent pages paginate twenty confirmed events, offer a starting-date filter, and disclose subscription instructions. Their DTOs and feeds continue to exclude notes, reasons, and pending requests.

`gymtime-calendar` receives validated schedule data, season/date context, team scope, and a selection capability. It emits `booking-open`, `slot-open`, and `time-open` numeric IDs, `day-open` dates, `week-shift` day offsets, and `today-open`. The planner owns these events, selection state, confirmations, and the existing adapter workflows. Setup receives a focus-section property and scrolls its own content for Publish time or Block gym; parents do not inspect child shadow roots.
