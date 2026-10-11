# Gymtime Frontend Architecture

Gymtime uses Gyral `0.3.1-next.9` for rendering and Effect for TypeScript workflows. Components present validated data and emit user actions; services handle network requests and decoding. The Rust backend remains authoritative for permissions and scheduling decisions.

This document specifies the first version's frontend. It complements [Architecture](../ARCHITECTURE.md) and [Scaffold specification](scaffold.md). It describes the implemented interface; [verification](verification.md) records the checks and their limits.

The owner approved the October 3 [UX audit](ux-audit.md). The implemented redesign separates pending review, current occupancy, time selection, and history without changing the scheduling rules.

The owner also approved [onboarding and contextual help](onboarding-and-help.md). `gymtime-guide` renders permission-aware guidance and a checklist derived from saved schedule data. Its events request navigation or personal preference changes; it does not submit scheduling actions. `gymtime-help-tip` uses native popovers with keyboard and touch activation. Shared help text and checklist decisions live in `domain/guidance.ts`; the parent guide receives only a public subscription URL.

Welcome dismissal and manual closure/sharing acknowledgments use a schema-validated local storage service, injected into the existing Effect runtime adapter. They are personal browser preferences, not synchronized organizer progress. Storage failure is visible and does not disable guidance. Saved schedule actions refresh the workspace's season and team selections immediately, including when the first season is created.

## Rendering and routes

The landing page is generated at build time with `@gyral/ssr`, using ordinary document markup for its content. Its text, headings, links, and sign-in navigation work without JavaScript. It does not fetch account or schedule data during generation. Rust serves the resulting HTML in production, so no JavaScript rendering service is required.

Sign-in, the authenticated application, and public team schedules use client rendering. Their client entry imports component definitions with the Gyral Vite preset’s `clientOnly` option. Do not hide prerendered landing content behind an undefined custom element. The landing page and interactive application have separate document entries and asset requirements.

| Route | Content | Rendering and search |
| --- | --- | --- |
| `/` | Product explanation and sign-in action | Generated HTML; eligible for indexing |
| `/sign-in` | Email and OTP forms | Client rendered; excluded from search |
| `/app/*` | Gym calendar, requests, team schedules, notifications, and organizer administration | Client rendered; authenticated data; excluded from search |
| `/teams/{token}` | One team's published schedule and calendar links | Client rendered; no account; excluded from search |

Document navigation uses ordinary links, direct entry, and the browser’s back and forward controls. The client entry supplies the shell’s route properties; page changes use native document navigation. The app does not need the optional Gyral router package for these routes. Rust recognizes supported document routes rather than returning the app shell for every unknown URL. Missing API routes and assets return their actual error status. Team documents carry search exclusion before JavaScript runs.

Local Vite development proxies API calls, health checks, and calendar feeds to Rust. The deployed frontend calls same-origin routes and uses cookies; it does not receive the Resend key, auth secret, or database configuration.

## Modules and imports

| Module | Responsibility | Boundaries |
| --- | --- | --- |
| `domain/` | Validated frontend identifiers, immutable models, display decisions, tagged errors | No DOM, HTTP, or runtime execution |
| `services/` | Effect service interfaces and typed workflows | Depends on domain; no component imports |
| `infra/` | HTTP, boundary schemas, browser storage where needed, and test/live layers | Implements services; converts external failures into named errors |
| `runtime/` | Layer composition, typed Gyral drivers, and the Effect adapter | The only application runtime execution boundary |
| `pages/` | Route orchestration, pure reducers, views, and intent parsing | Returns typed commands; no runtime execution |
| `components/` | Presentational custom elements | Validated properties in, canonical Gyral outputs out; no service or runtime access |
| `styles/` | Tokens, global foundations, themes, and shared component style modules | Static style definitions; validated calendar data supplies grid positions and counts |

Generated transport types live in the contracts workspace package. They describe wire data; they do not bypass runtime decoding. Effect Schema decodes network responses once at the HTTP boundary. Native forms provide strings and constrained options; Rust parses and validates every command. Generated wire types retain transport numbers and nullable fields. Display helpers use these immutable, validated DTOs; they do not grant permissions or cast JSON into domain types.

Use tagged unions for workflow states. Transport DTOs retain JSON nulls for contract compatibility; UI state uses optional record selections and one dialog discriminator. Network responses are decoded once at the Effect HTTP boundary. Property schemas synchronously validate values supplied to components. Application code follows the Effect restrictions on `async/await`, `try/catch`, `throw`, `any`, non-null assertions, and untyped errors. Promise APIs are wrapped at infrastructure or build boundaries.

## One runtime, one source of state

The browser entry mounts one `ManagedRuntime` and provides named Gyral drivers through the application root. The document owns disposal on a non-persisted `pagehide`; moving a component or entering the browser back/forward cache keeps that runtime. Individual components own command cancellation and subscription cleanup. Drivers pass Gyral's abort signal to the adapter and Effect HTTP client. Effect services continue to own network workflows, boundary decoding, and mutation identities.

Components use `define<State, Msg, Props, Out>()`, typed `data-intent` parsers, pure reducers, and pure views. Reducers return commands as data. Drivers deliver `Either` results as messages; expected failures remain visible and preserve drafts. Unexpected defects become a safe typed failure rather than an empty successful schedule. Reads use `switch`, writes use `exhaust`, and preference writes use `queue`. The workspace also rejects schedule responses issued before a mutation or newer refresh.

The planner's state and transitions live in `pages/workspace/model.ts`. Native form parsing lives in `intents.ts`; calendar navigation, finder/selection, requests, history, swaps, sharing, booking details, review, and the outer view have separate modules. Setup, people, notifications, authentication, and the parent calendar each own their local state. There is no global writable schedule cache or second state framework.

Selection notes, activity, reason, and scope belong to one reducer draft. Form intents read native controls at the event boundary; templates use Gyral's live `value`/`checked` attributes and textarea content. Keyed request groups use `each` with a pure module-level row and explicit view context. Child components emit canonical `gyral-output` values consumed through typed `child()` parsers.

Calendar buttons open one booking's details in a native dialog. Move and swap forms are created when their disclosure first opens, then kept mounted to preserve choices across collapse and schedule refresh. Move and pending-request editors filter slots by a chosen date. Calendar rendering never mounts the season's booking history or its editing forms.

Each value has one owner. Do not keep the same schedule in a signal store and an Effect `SubscriptionRef`, or synchronize duplicate page and global caches. Derived views are pure computed values. Replace arrays and records immutably, and update shared state after confirmed responses. Show pending server operations explicitly; do not display an unapproved request as a confirmed booking.

## Components and styling

Name elements with the `gymtime-` prefix, one element per file. Declare property and event types, and document events that cross component boundaries. Canonical child outputs bubble within their direct parent’s shadow tree and are consumed by typed child intents. A parent never reaches into a child's shadow root.

Use function-based Gyral definitions without decorators; `useDefineForClassFields` is enabled. Keep TypeScript's `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` enabled. Pure derived values belong in view helpers; rendering must not perform requests, mutate shared state, or dispatch actions.

Use native links for navigation, buttons for actions, labeled form controls, fieldsets for related inputs, and headings and landmarks in document order. Custom elements organize those elements; they do not replace their semantics. A weekly visual grid also has a usable chronological list. Calendar cells expose team, time, space, and status in text, including pending or competing requests. Color is an additional cue.

Global CSS defines layers, tokens, typography, and document foundations. Shadow-root component styles use static Gyral `css` definitions and inherited custom properties. Global layer rules do not automatically style shadow contents. Components expose documented parts when callers need presentation hooks. Use container queries where component layout depends on available space, logical properties, visible focus, and reduced-motion preferences.

Support light and dark themes through tokens, starting from system preference with an optional local preference. Preserve readable contrast and native control behavior. Scope any loading visibility guard to the client-rendered root so it cannot conceal the landing page.

## Screen behavior

The desktop calendar presents a week with gym spaces; small screens default to a chronological list with date, team, time, space, and status. Users can change the date range and filter by team or space. Filters do not change permission to inspect scheduling information.

Primary coaches can request existing slots, explain a competing request, select recurring occurrences, withdraw requests, cancel approved dates, propose changes, and propose or accept swaps. Assistant coaches receive the same scheduling information with viewing controls. Organizers can publish slots and closures, decide requests, and manage seasons and assignments.

Before a bulk action, show the affected dates and distinguish dates that can proceed from conflicts or missing slots. Before a closure, show the bookings it will cancel. A cancellation explains that the slot becomes requestable immediately. A swap shows both teams, times, and spaces, the acceptance deadline, and that acceptance completes the exchange. Backend responses decide the actual outcome.

Forms associate errors with their controls. Submission state disables duplicate actions without trapping focus. Dialogs manage initial focus, dismissal, and focus return. Completion and failure messages are announced without repeatedly reading the entire calendar. Keyboard use must cover date navigation, requesting a slot, approval, cancellation, and accepting a swap.

Parents see their team's confirmed activities, gym timezone, webpage link, and subscription/download actions. They do not receive internal notes, account details, competing reasons, or pending requests in HTML, JSON, or calendar files. Search exclusion and data projection are backend policies as well as UI behavior.

## Verification

Use Vitest 4 for pure frontend tests and browser component tests. The selected Effect 3 `@effect/vitest` integration targets Vitest 3, so it is excluded. Workflow tests use a scoped test runtime with injected HTTP and retry-key services under the same Vitest version; each test releases its runtime. This preserves testable Effect workflows without installing incompatible test runners.

DOM-free model tests use `@gyral/testing` to inspect transitions and commands. A seeded property test checks selection uniqueness and physical compatibility across arbitrary toggle sequences. Regression cases cover draft preservation, stale read failures, duplicate writes, and mutation keys after a failed reload. Browser tests replace Gyral drivers; service workflow tests inject Effect Layers.

Browser component tests use the matching Vitest Playwright provider. Await Gyral `settled()` and assert visible output and native control behavior. Full-stack Playwright tests use Rust, temporary SQLite state, and an isolated email adapter. They cover direct routes, permission changes, schedule mutations, parent projections, and calendar responses. The configured checks run Chromium and WebKit with two workers against one temporary SQLite service. Firefox and real calendar clients are additional release checks, not claimed coverage.

Generate element typings with `gyral-types`, check templates with Gyral ESLint rules, and compile templates through the Gyral Vite preset during production builds. Enforce import boundaries, the Effect runtime boundary, and prohibited application constructs. Accessibility checks combine automated checks with keyboard and focus assertions. Browser automation does not prove that an actual iPhone subscription refreshes correctly; that needs a release check on a calendar client.

The planner has Calendar, Find time, Requests, History, Swaps, Parent links, and Notifications views. Organizer administration contains Gym setup and People. Native confirmation dialogs show affected dates; field-error hooks and revalidation subscriptions own their event listeners and clean up on disconnect. Scheduling retries reuse a mutation key, including after a successful write followed by a failed reload. Returning to the workspace or team webpage triggers a refresh; calendar subscribers refresh on their client's schedule.

## Scheduling workspace

Organizers default to All gym. Coaches and assistants default to My teams, including every team where they are primary or assistant; a team switch and All gym remain available. Only primary coaches and organizers receive scheduling actions. The backend checks those permissions again. One active season can receive bookings; switching seasons clears the selection and resets its team context.

The calendar uses aligned minute rows and two space lanes. Week and Day views allocate `7rem` per hour so ordinary one-hour bookings have room for their details. Hour labels, minute rows, and grid lines share the same CSS height scale; changing it preserves booking positions. The weekly grid has a minimum width of `60rem` to keep half-gym labels readable; narrower desktop containers can scroll the calendar horizontally. A full-gym booking spans both lanes; each confirmed booking appears once in the visible view. Published availability is separate from occupancy. Unavailable entries open their slot and closure details. Equivalent full/half availability choices use a single full-gym calendar entry; Find time exposes each published alternative. Day and chronological List views are available on desktop. Narrow layouts use a selected-day agenda and date strip. Weeks with afternoon practices and morning games initially show afternoon hours, with an explicit earlier-times notice and Show all hours action. Day view uses that day's published hours. Native buttons expose date, time, team, space, activity, and status without claiming ARIA grid behavior.

Find time filters published, available slots by team, date range, and gym space. Selecting another physical alternative replaces an overlapping selection. Selections persist across filter and date changes; the desktop review panel and mobile Review selection bar keep the next action visible. A native review dialog supports mobile submission and returns focus to its trigger. The activity, note, competing reason, and change scope share one draft across desktop and mobile review, including closing the panel or returning from confirmation. The chosen team receives every selected date. Repeat weekly expands each distinct weekday/time/space pattern through an end date, deduplicates matches, and lists missing or unavailable dates. The finder displays the first fourteen matching days and explains how to reach later dates.

Requests defaults to pending work, sorted by first affected date. Recurring dates group by team, series, new/change type, activity, note, and reason. These intent fields distinguish separate change proposals that reuse an original booking series. Physical competitions connect related rows into a comparison group; compatible halves stay separate unless linked by a full-gym competitor. The queue shows both group and occurrence counts. Team, type, affected-date, and competing filters sit in a disclosure. Selections survive filtering; approval is disabled when selected requests physically compete. Confirmation lists selected dates and named competing cancellations. Changes show the original confirmed time beside the requested replacement.

History paginates twenty bookings or completed request groups, with search and status filters. A request group retains all its completed outcomes when a filter matches one date, so mixed approvals and declines remain visible. Pending and completed swaps have separate views. Notifications paginate twenty messages and disclose message bodies; organizer audit history is secondary. Parent pages paginate twenty confirmed events, offer a starting-date filter, and disclose subscription instructions. Their DTOs and feeds continue to exclude notes, reasons, and pending requests.

`gymtime-calendar` receives validated schedule data, season/date context, team scope, and a selection capability. Its output union is `Booking`, `Slot`, `Time`, `Day`, `Shift`, and `Today`. The planner owns these messages, selection state, confirmations, and adapter workflows. Setup receives a focus-section property and uses its own lifecycle hook to focus and scroll content for Publish time or Block gym.
