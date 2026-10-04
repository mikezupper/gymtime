# Contributing to Gymtime

Gymtime helps organizers and coaches share one basketball gym. Contributions should make that work easier while preserving scheduling rules, role permissions, and the privacy of team calendars.

## Start with the problem

Search [existing issues](https://github.com/mikezupper/gymtime/issues) before opening a bug or proposal. Describe the role involved, the action taken, the result, and the result you expected. Use fictional teams and addresses. For a substantial feature or architecture change, discuss its scope in an issue before implementing it.

Small fixes, documentation improvements, and accessibility corrections can go straight to a pull request. Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through the [security policy](SECURITY.md), rather than a public issue.

## Set up a contribution

Fork the repository, clone your fork, and create a branch for one change. Follow [README setup](README.md#run-locally) and [local development](docs/development.md) to install the pinned tools and run the app. Development captures email locally and uses an ignored SQLite database.

Read the [requirements](docs/requirements.md), [architecture](ARCHITECTURE.md), and [frontend guide](docs/frontend.md) before changing behavior. [AGENTS.md](AGENTS.md) describes the workflow for coding agents. GitHub issues are the public place for discussion; maintainers and agents use Beads for local execution tracking. Do not commit local Beads records or create a second backlog in Markdown.

## Keep the boundaries clear

- Rust owns authorization and schedule mutations. Conflict checks and writes belong in the same SQLite write transaction.
- The domain is pure. App use cases depend on ports; the server wires database, email, HTTP, and other infrastructure.
- Lit owns rendering and lifecycle. Effect owns typed workflows and injected services, executed through the browser runtime adapter.
- Parent pages and feeds expose only confirmed team schedules. They must omit internal notes, coach addresses, and pending requests.
- Use native controls, semantic HTML, keyboard access, clear names, and responsive CSS. Explain unfamiliar actions in language appropriate to each role.

Apply the pinned public skills and documented interpretations in [engineering decisions](docs/engineering.md). Do not customize copied instructions in place. Use the explicit update command and review its provenance, licenses, and diff. Follow [writing conventions](docs/writing.md) for project documents and interface text.

## Verify the change

Run the relevant checks before requesting review:

```bash
pnpm check
pnpm test:unit
pnpm test:browser
pnpm test:e2e
pnpm build
```

Documentation-only changes need `pnpm docs:check` and a review against the current code. API changes also need regenerated contracts; migration changes need regenerated schema documentation. Use tests that demonstrate behavior, permissions, or failure handling. Avoid tests that merely repeat the implementation.

For interface changes, inspect desktop and narrow layouts, keyboard interaction, and both browser engines. Include sanitized screenshots when they help reviewers understand the result. Update durable requirements or designs when behavior changes, and report checks you could not run. CI runs the full suite and builds the container.

## Submit a focused pull request

Explain the problem and resulting behavior, link the public issue when applicable, and state how you verified the change. Keep commits focused and write messages that describe their effect. Do not add co-author trailers to commit messages or PR descriptions.

Before committing, review `git diff --cached`. Exclude credentials, `.env`, database files, backups, authentication captures, private instructions, real parent links, and personal or school data. Use a GitHub no-reply author email if you do not want a personal address in commit metadata. Browser reports and local task records stay ignored.

Maintainers may request revisions or narrower scope. A passing check does not replace review of scheduling behavior and privacy. There is no guaranteed response time.

By submitting original code or documentation, you agree to license it under [MIT](LICENSE). Retain licenses and attribution for third-party material; see [Third-party notices](THIRD_PARTY_NOTICES.md). No contributor license agreement or co-author attribution is required.
