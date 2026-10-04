# Working in Gymtime

Gymtime schedules access to one basketball gym. Email-code sign-in, invitations, scheduling, notifications, and parent calendars are implemented against the approved requirements. Read the requirements and verification evidence before extending the app.

## Read the repository map

- [Workflow walkthrough](docs/workflows.md): setup and testing from each role.
- [Product requirements](docs/requirements.md): roles, scheduling rules, notifications, and acceptance scenarios.
- [Architecture](ARCHITECTURE.md): Rust layers, transactions, authentication, calendars, and deployment.
- [Frontend architecture](docs/frontend.md): Lit, Effect, state, accessibility, and browser verification.
- [Scaffold specification](docs/scaffold.md): foundation files, commands, toolchain, skills, and scaffold acceptance.
- [Engineering decisions](docs/engineering.md): owner-selected stack and skill sources.
- [Local development](docs/development.md) and [VPS operation](docs/deployment.md): setup, verification, and recovery.
- [Harness reference](docs/references/openai-harness-engineer.md): repository knowledge and feedback approach.

## Track work in Beads

Run `bd prime` at session start and after compaction. Use `bd ready`, inspect the relevant issue, and claim it before implementation. Close completed issues before reporting completion. Beads holds task status and dependencies; documents hold durable requirements and designs. Do not add a Markdown backlog or a second task tracker.

Beads state is local and excluded from Git. Initialize your own local tracker when needed; never publish another developer's task records. Hooks are not installed. Do not run setup that overwrites this guide. Follow the current session's Git authorization; the initialized Beads context grants no Git operations. Deployment and external publishing require user authorization.

## Apply the requested skills

Read the applicable entrypoints and references linked in [Engineering decisions](docs/engineering.md). They resolve to pinned copies under `.agents/skills`, with provenance and hashes in `skills.lock.json`. Apply updates explicitly; do not edit copied instructions in place.

Follow [Writing conventions](docs/writing.md) for project documents and product writing. Use the Rust skill for backend work, and the Effect, Lit, modern CSS, semantic HTML, and Google SEO skills for their respective frontend concerns. User requirements take precedence over skill examples. Documented interpretations resolve styled Lit semantics, SQLite, and test-version compatibility.

## Preserve the boundaries

Rust owns permissions and every schedule mutation. The pure domain has no driver or framework dependencies. The app owns transactions through ports; only the server wires infrastructure. Check and write conflicting bookings in one SQLite write transaction.

Lit owns rendering and component lifecycle. Effect owns typed workflows and injected services. Execute them through one browser runtime adapter. Parent DTOs, pages, and feeds omit internal notes and pending requests.

## Verify and report accurately

Run checks appropriate to the change. Use the root commands documented in the scaffold and development guide. For documentation work, check consistency and local links. For application work, use the relevant contract, architecture, Rust, and browser checks defined in the scaffold.

Never add co-author trailers to commits or PR descriptions. Exclude credentials, personal addresses, datasets, and private instructions from commits. Keep the repository documents current when behavior or architecture changes. Distinguish owner requirements, design defaults, and tested behavior. Report meaningful limitations without claiming unrun tests, working endpoints, or deployment.
