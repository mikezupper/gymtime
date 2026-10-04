# lit-web-apps — an Agent Skill for Framework-Free Web Applications

[![Lit](https://img.shields.io/npm/v/lit?label=lit&logo=lit&logoColor=white&color=324fff)](https://www.npmjs.com/package/lit)
[![@lit/context](https://img.shields.io/npm/v/@lit/context?label=%40lit%2Fcontext&color=324fff)](https://www.npmjs.com/package/@lit/context)
[![@lit/task](https://img.shields.io/npm/v/@lit/task?label=%40lit%2Ftask&color=324fff)](https://www.npmjs.com/package/@lit/task)
[![@lit-labs/ssr](https://img.shields.io/npm/v/@lit-labs/ssr?label=%40lit-labs%2Fssr&color=f9a825)](https://www.npmjs.com/package/@lit-labs/ssr)
[![@lit-labs/signals](https://img.shields.io/npm/v/@lit-labs/signals?label=%40lit-labs%2Fsignals&color=f9a825)](https://www.npmjs.com/package/@lit-labs/signals)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-build%20%2B%20SSR-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest%204-browser%20mode-6e9f18?logo=vitest&logoColor=white)](https://vitest.dev/guide/browser/)
[![Web Components](https://img.shields.io/badge/Web%20Components-standards--based-29abe2?logo=webcomponentsdotorg&logoColor=white)](https://developer.mozilla.org/docs/Web/API/Web_components)
[![DSD](https://img.shields.io/badge/Declarative%20Shadow%20DOM-Baseline%202024-1a73e8)](https://web.dev/articles/declarative-shadow-dom)
[![Meta-frameworks](https://img.shields.io/badge/meta--frameworks-0-success)](https://lit.dev/)
[![License](https://img.shields.io/badge/license-CC_BY_4.0-lightgrey)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/mikezupper/lit-web-apps-skill)](https://github.com/mikezupper/lit-web-apps-skill/commits/main)
[![Repo stars](https://img.shields.io/github/stars/mikezupper/lit-web-apps-skill?style=flat&logo=github)](https://github.com/mikezupper/lit-web-apps-skill/stargazers)
[![Skill audit](https://img.shields.io/badge/last%20research%20audit-2026--07-8a2be2)](#keeping-the-skill-updated)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/mikezupper/lit-web-apps-skill/pulls)

> Blue badges track stable graduated packages live from npm; yellow badges track `@lit-labs` packages this skill knowingly depends on — if a labs badge's major version jumps, trigger the [maintenance playbook](#keeping-the-skill-updated).

**Proof:** [**lit-web-apps-examples**](https://github.com/mikezupper/lit-web-apps-examples) — five working apps built *with* this skill (SSG docs site, kanban, real-time dashboard, SSG+SSR+CSR storefront, design system; 74 passing tests). Building them hardened the skill: every correction they surfaced is committed here.

---

## Motivation

For a decade, "building a web app" has meant adopting a framework's private universe: a virtual DOM, a proprietary component model, a meta-framework for SSR, a portal system, a form library, an animation library, and a migration treadmill. Meanwhile the platform quietly shipped the real thing:

- **Custom elements + shadow DOM** — a native component model with real encapsulation
- **Declarative Shadow DOM** (Baseline 2024) — server-rendered components that paint with **zero JavaScript**
- **URLPattern + Navigation API** — native routing primitives
- **TC39 Signals** (polyfilled today) — a standards-track reactivity model
- **ElementInternals** — native form participation and validation
- **Top layer (popover/dialog), View Transitions, container queries** — the entire "UI library" tier

Lit is the thin (~5 KB) layer that makes these primitives ergonomic — reactive properties, tagged-template rendering, controllers — without replacing them. Components built this way are standard DOM: they outlive framework cycles, interop with anything, and carry no runtime tax.

This skill exists because the knowledge to do this well is scattered across lit.dev, labs READMEs, changelogs, and community lore — and because the hard 20% (SSR wiring, hydration ordering, data flow, routing) has no official scaffold. The skill encodes those decisions once so an AI agent (or a human) builds it right the first time, **with no React, Next.js, or any meta-framework**.

## Overview

An [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills): a `SKILL.md` entry point holding the pinned stack, ten golden rules, the project scaffold, and decision tables — plus thirteen reference files loaded on demand:

| Reference | Covers |
|---|---|
| `project-setup.md` | tsconfig (decorator flags), Vite config, dev/prod servers, build pipeline |
| `components.md` | Reactive properties, lifecycle, controllers, mixins, shadow DOM, styling/theming |
| `templating.md` | Expression types, all built-in directives, custom/async directives, statics |
| `data-and-state.md` | Signals / context / task ladder; the SSR→client data-flow convention |
| `rendering-modes.md` | SSR streaming, SSG prerendering, hydration, `defer-hydration` islands, SEO |
| `routing.md` | Canonical URLPattern + Navigation API router controller (isomorphic) |
| `testing.md` | Vitest 4 browser mode, fixtures, shadow DOM assertions, a11y, SSR tests |
| `performance.md` | Perf directives, virtualizer, template compiler, loading strategy |
| `localization.md` | `@lit/localize` runtime vs transform modes, XLIFF workflow |
| `architecture.md` | Layering, monorepos, design systems, Rust/Go backend integration |
| `forms.md` | Form-associated custom elements, ElementInternals, validation, `:state()` |
| `interaction.md` | Popover/dialog top layer, `@lit-labs/motion`, View Transitions, observers |
| `security.md` | Unsafe-API rules, Trusted Types, script-safe serialization, CSP |

## Approach

1. **Research-pinned, not vibes-pinned.** Every choice was made against a dated audit of lit.dev docs, the lit monorepo, npm registry state, and labs graduation status (last audit: **2026-07**). Choices are recorded as a table in `SKILL.md` so agents don't relitigate them mid-task.
2. **One pipeline, three rendering modes.** `@lit-labs/ssr` renders templates to HTML with Declarative Shadow DOM. Run it per-request → **SSR**. Run it at build time over the route table → **SSG**. Skip it → **CSR**. Each route declares its mode; same components everywhere.
3. **Platform over packages.** Routing is ~100 lines over URLPattern + Navigation API. Overlays use the top layer. Forms use ElementInternals. Animation starts with View Transitions. A dependency must beat the platform, not merely wrap it.
4. **Signals-forward state.** Shared state uses `@lit-labs/signals` — a bet on the TC39 standard, not on a store vendor. The stable tier (`@lit/context` for services, `@lit/task` for async) carries everything else.
5. **Backend-agnostic by construction.** All data access sits behind typed service interfaces. Lit SSR needs a JS runtime, so the skill defines three deployment shapes: SSG-only (Rust/Go/CDN serves static files — no JS runtime in prod), a stateless Node render tier in front of Rust/Go APIs, or CSR against any API.
6. **Honest about maturity.** Labs packages (`ssr`, `signals`, `virtualizer`, `motion`) are used deliberately and flagged, with pinning guidance and watch-list entries below. Stalled options (labs router, Vaadin Router) are named and avoided.

## Principles

- **The platform is the framework.** Every component is a standard custom element; nothing in the app can't run in vanilla HTML.
- **Rendering is pure.** `render()` is a function of properties and signals; derived state in `willUpdate()`; effects in `updated()`.
- **Data flows one way.** Properties down, events up, context for services, signals for shared state — with a strict ladder so each piece of state has exactly one right home.
- **The server renders synchronously.** All async work happens in route handlers; components receive finished data. This single rule prevents the entire class of SSR bugs.
- **Progressive enhancement is free, so take it.** DSD paints without JS, `<a href>` navigates without JS, native forms submit without JS — hydration adds interactivity, it doesn't gate content.
- **Encapsulation is real.** No component reaches into another's shadow root; the public API is properties, events, slots, parts, and tokens.
- **Test in a real browser.** Shadow DOM is not emulatable; `await el.updateComplete` is law.

## How to leverage the skill

**Installation** — place the `lit-web-apps/` directory where your agent discovers skills:

```bash
# Claude Code, global (all projects):
git clone https://github.com/mikezupper/lit-web-apps-skill.git ~/.claude/skills/lit-web-apps

# Claude Code, per-project:
git clone https://github.com/mikezupper/lit-web-apps-skill.git your-project/.claude/skills/lit-web-apps
```

The frontmatter `description` triggers automatic loading whenever a task involves building or modifying a Lit app; you can also invoke it explicitly (`/lit-web-apps` in Claude Code).

**What to ask for** — the skill shines on whole-app and hard-integration work:

- *"Scaffold a new Lit app with an SSG marketing site and an SSR product catalog"* → route table with mixed modes, Hono server, prerender script, hydration entry
- *"Add a checkout form"* → form-associated custom elements with native validation, not a form library
- *"This list of 50k rows is slow"* → virtualizer + keyed repeat + the measurement checklist
- *"Add German and Japanese"* → `@lit/localize` transform mode wired into the SSG pipeline
- *"Our APIs are in Go"* → service-interface pattern + render-service or SSG deployment shape

**Division of labor**: `SKILL.md` is always in context (rules + decisions); the agent pulls reference files only when the task touches their area. Keep it that way when extending — new depth goes in a reference file, new *rules* go in `SKILL.md`, and `SKILL.md` stays lean.

## Keeping the skill updated

The skill is a **dated snapshot** (2026-07) of a moving ecosystem. It stays trustworthy through a quarterly audit, not through hope.

### Quarterly playbook (~30 min, agent-executable)

Run this prompt against the skill directory:

> Audit `lit-web-apps/` against current reality: (1) check npm for major/minor bumps of every package pinned in SKILL.md and project-setup.md; (2) fetch https://lit.dev/docs/libraries/labs/ and diff graduation statuses against the skill's stack table; (3) scan https://lit.dev/blog/ and the lit monorepo changelogs since the last-audit date; (4) check the watch list below; (5) propose edits as a diff, update the last-audit badge date.

### Watch list — changes that trigger rewrites

| Signal | Impact when it fires |
|---|---|
| `@lit-labs/ssr` graduates to `@lit/ssr` | Update imports everywhere; drop "labs" caveats; likely API polish to adopt |
| `@lit-labs/signals` graduates / TC39 Signals advances stage | Re-pin; adopt signal-aware `repeat`, `@property`-signal integration, `@computed`/`@effect` decorators as they land |
| Standard decorators become the Lit recommendation (native browser support) | Flip tsconfig flags, add `accessor` keyword — mechanical but touches every component |
| Official Lit Vite SSR integration ships | Replace the hand-rolled `server/dev.ts` wiring in project-setup.md |
| A first-party router graduates | Re-evaluate against the URLPattern controller in routing.md |
| `@lit-labs/forms` stabilizes (currently 0.1.x) | Evaluate as the form-binding layer in forms.md |
| Navigation API reaches Baseline (Safari/Firefox) | Delete the click/popstate fallback from the router |
| Lazy-hydration mixin ships (lit/lit#4822) | Replace the manual `defer-hydration` island wiring |
| `@lit-labs/compiler` matures / gains Vite support | Promote from optional to default in the build pipeline |
| Lit 4.x | Full audit — breaking-change review across every reference file |

### Update rules

- **Every audit updates the badge date** — a stale badge is the signal that the whole skill is suspect.
- Version pins: stable packages float on caret; labs packages pin minor and only bump after reading the changelog.
- New content follows the existing split: rules → `SKILL.md`, depth → `references/*.md`, and nothing exceeds the platform-first principle without a measured justification.
- Deliberate exclusions stay excluded unless scope changes: `@lit/react` and all framework wrappers, `@lit-labs/preact-signals`, `@lit-labs/nextjs`, Eleventy/Rocket integrations (this skill owns its own SSG), Web Test Runner as the primary runner (kept only as the optional hydration-test escape hatch).

## Primary sources

[lit.dev docs](https://lit.dev/docs/) · [Labs status](https://lit.dev/docs/libraries/labs/) · [SSR](https://lit.dev/docs/ssr/overview/) · [Templates](https://lit.dev/docs/templates/overview/) · [Composition](https://lit.dev/docs/composition/overview/) · [Context](https://lit.dev/docs/data/context/) · [Signals](https://lit.dev/docs/data/signals/) · [Tools](https://lit.dev/docs/tools/overview/) · [Localization](https://lit.dev/docs/localization/overview/) · [lit/lit monorepo](https://github.com/lit/lit/) · [Lit blog](https://lit.dev/blog/) · [Vitest browser mode](https://vitest.dev/guide/browser/) · [web.dev DSD](https://web.dev/articles/declarative-shadow-dom)

## License

Text and markup licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) © 2026 Mike Zupper.
