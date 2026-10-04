<div align="center">

# beads-skill

**A comprehensive, version-pinned agent skill for [beads](https://github.com/gastownhall/beads) (`bd`) — the Dolt-backed, dependency-aware issue tracker built for AI coding agents.**

[![validate](https://github.com/mikezupper/beads-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/mikezupper/beads-skill/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/github/license/mikezupper/beads-skill?color=blue)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill/commits/main)
[![Commit activity](https://img.shields.io/github/commit-activity/m/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill/pulse)

[![beads](https://img.shields.io/badge/beads-v1.2.2-2e8555)](https://github.com/gastownhall/beads/releases)
[![Claude Code](https://img.shields.io/badge/Claude_Code-skill-d97757)](https://claude.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-compatible-000000)](https://developers.openai.com/codex)
[![MCP](https://img.shields.io/badge/MCP-documented-6f42c1)](https://modelcontextprotocol.io)
[![Docs](https://img.shields.io/badge/docs-13_files_·_5.9k_lines-informational)](skills/beads/)

[![Stars](https://img.shields.io/github/stars/mikezupper/beads-skill?style=flat)](https://github.com/mikezupper/beads-skill/stargazers)
[![Forks](https://img.shields.io/github/forks/mikezupper/beads-skill?style=flat)](https://github.com/mikezupper/beads-skill/network/members)
[![Issues](https://img.shields.io/github/issues/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill/pulls)
[![Contributors](https://img.shields.io/github/contributors/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill/graphs/contributors)
[![Repo size](https://img.shields.io/github/repo-size/mikezupper/beads-skill)](https://github.com/mikezupper/beads-skill)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant%202.1-5e0d73)](CODE_OF_CONDUCT.md)

</div>

---

## What problem does Beads solve?

Coding agents are effective within a session, but their working context is
temporary. Sessions end, context gets compacted, processes crash, and multiple
agents can unknowingly duplicate work. Plans stored in chat, Markdown
checklists, or scattered TODOs quickly become incomplete or stale.

[Beads](https://github.com/gastownhall/beads) gives agents a durable,
dependency-aware work graph outside the context window. Each unit of work — a
**bead** — can store its description, acceptance criteria, status,
dependencies, notes, and history.

That creates a repeatable execution loop:

```text
Find ready work → claim it → implement it → record discoveries → close it
                                              ↓
                                  newly unblocked work becomes ready
```

This improves agent-assisted development by making it possible to:

- resume reliably after a new session or context compaction,
- determine what can be worked on without re-planning the project,
- coordinate multiple agents without duplicating work,
- represent blockers and safe opportunities for parallel execution,
- preserve discoveries, decisions, and handoff notes, and
- maintain an auditable history of the project's execution state.

Beads does not make an agent smarter or replace good engineering judgment. It
provides persistent memory and coordination — the infrastructure agents need
to work reliably on long-running projects. It is most useful when work spans
multiple sessions, contains dependencies, or involves multiple agents; a
small, one-session change may not need it.

## Beads vs. this repository

[Beads](https://github.com/gastownhall/beads) is the underlying task system: a
Dolt-backed, dependency-aware issue tracker exposed through the `bd` CLI.

**beads-skill** is the operating manual for agents using that system. It
distills Beads' large command surface into a small set of rules, workflows,
and progressively loaded references so agents can use it consistently and
safely.

---

## Contents

- [What problem does Beads solve?](#what-problem-does-beads-solve)
- [Beads vs. this repository](#beads-vs-this-repository)
- [Why this skill exists](#why-this-skill-exists)
- [What's inside](#whats-inside)
- [Installation](#installation)
- [Install order vs. `bd init`](#install-order-vs-bd-init)
- [Configuration](#configuration)
- [How the skill is organized](#how-the-skill-is-organized)
- [Maintenance: the beads submodule](#maintenance-the-beads-submodule)
- [Version pin and known upstream drift](#version-pin-and-known-upstream-drift)
- [How this was verified](#how-this-was-verified)
- [Comparison with upstream's own skills](#comparison-with-upstreams-own-skills)
- [Contributing](#contributing)
- [License and attribution](#license-and-attribution)

---

## Why this skill exists

Beads makes the work graph the memory: every unit of work is a bead with typed
dependencies, and `bd ready` computes the claimable frontier so the *graph*
decides what is workable next, not a human dispatcher or a half-remembered
conversation.

Beads also has a **109-command CLI**, six storage/sync concepts, a workflow
engine (formulas → protos → molecules → wisps → gates), multi-repo routing,
federation, and roughly **1 MB of documentation across 182 files**. An agent
cannot hold that, and the guidance it needs most — *never run `bd edit`, get
the dependency direction right, close what you finish* — is scattered across
pages written for humans.

This repository is that corpus distilled into an agent skill:

- **A lean entry point.** `SKILL.md` is ~260 lines: 12 hard rules, the session
  loop as runnable bash, the 20 commands that cover ~95% of agent work, and a
  routing table. That is what loads on trigger.
- **Exhaustive references behind it.** Twelve files, ~5,600 lines, opened only
  when needed. Every `bd init` flag, every config key, every recovery runbook.
- **Verified against a real binary, not just the docs.** Upstream's prose has
  drifted from what ships; see [known drift](#version-pin-and-known-upstream-drift).
  Where they disagree, this skill follows the binary and records the conflict.
- **Version-pinned and maintainable.** Upstream is a git submodule; one script
  refreshes it and rewrites the pin record so you can see exactly what changed.

### Why not just use upstream's skill?

Beads ships its own. It is good, and it is **stale**: its frontmatter declares
`version: 0.60.0` and its own validation section warns *"if `bd --version`
reports newer than 0.60.0, this skill may be stale."* Current beads is 1.2.2,
and the drift shows — it points at `bd pour`, `bd wisp`, and `bd agent`, none
of which exist anymore (they became `bd mol pour` / `bd mol wisp`).

It also **permits `TodoWrite`** for single-session work, devoting a 17 KB
reference to the bd-vs-TodoWrite decision — while `bd prime` on 1.2.2 states
plainly: *"Prohibited: Do NOT use TodoWrite, TaskCreate, or markdown files for
task tracking."* This skill follows `bd prime`.

Full side-by-side in [Comparison](#comparison-with-upstreams-own-skills).

---

## What's inside

```
beads-skill/
├── skills/beads/
│   ├── SKILL.md                          # ~260 lines — the operating manual
│   └── references/
│       ├── 01-installation-and-init.md   # install, every bd init flag, storage modes, upgrade
│       ├── 02-core-concepts.md           # bead anatomy, fields, types, IDs, labels, metadata
│       ├── 03-dependencies-and-ready.md  # edge types, ready semantics, cycles, graph views
│       ├── 04-cli-reference.md           # every command, grouped, with the flags that matter
│       ├── 05-workflows.md               # formulas → molecules/wisps, gates, swarms, todo
│       ├── 06-agent-playbook.md          # session protocol, issue standards, recovery
│       ├── 07-multi-agent.md             # claiming, merge slots, routing, federation
│       ├── 08-sync-and-storage.md        # Dolt model, push/pull, backup, hooks, worktrees
│       ├── 09-configuration.md           # precedence, every key, env vars, agent profiles
│       ├── 10-harness-integration.md     # Claude Code, Codex, MCP, bd setup recipes
│       ├── 11-troubleshooting.md         # bd doctor, safety refusals, corruption, sandboxes
│       └── 12-json-and-scripting.md      # JSON contract, query language, batch, events journal
├── beads/                                # upstream reference (git submodule; never committed)
├── scripts/
│   ├── update-beads.sh                   # refresh submodule + regenerate the pin record
│   └── validate.sh                       # structural checks (also run in CI)
├── BEADS_VERSION.md                      # what this was verified against + known drift
├── NOTICE.md                             # attribution
└── LICENSE                               # MIT
```

**Consumers only need `skills/beads/`.** The submodule is a maintenance aid; a
plain `git clone` without `--recurse-submodules` gives you a fully usable skill.

---

## Installation

### Claude Code — user scope (recommended)

Available in every project, and outside any repo, so no `bd` command can touch
it:

```bash
git clone https://github.com/mikezupper/beads-skill.git
mkdir -p ~/.claude/skills
cp -r beads-skill/skills/beads ~/.claude/skills/
```

### Claude Code — project scope

Commit it alongside the project so teammates get it too:

```bash
mkdir -p .claude/skills
cp -r /path/to/beads-skill/skills/beads .claude/skills/
```

### Codex

Codex reads `.agents/skills/`. **Read
[the next section](#install-order-vs-bd-init) first** — this is the one place
where `bd init` will overwrite your file.

```bash
mkdir -p .agents/skills
cp -r /path/to/beads-skill/skills/beads .agents/skills/
```

### Any other harness

The files are plain markdown; nothing outside `SKILL.md`'s YAML frontmatter is
harness-specific. Point your agent at `skills/beads/SKILL.md` and let it follow
the routing table.

> `references/` must travel with `SKILL.md` — the routing table is the point.

---

## Install order vs. `bd init`

`bd init` installs agent instructions by default, **including a skill of its
own named `beads`**. Verified on bd 1.2.2, a default `bd init --quiet` writes:

```
.beads/…                          the database and hooks
AGENTS.md · CLAUDE.md             managed beads sections
.claude/settings.json             SessionStart hook → bd prime
.codex/config.toml · hooks.json   Codex hook lifecycle
.agents/skills/beads/SKILL.md     ← upstream's ~2 KB beads skill
```

| Harness | Skill path | Collides? |
|---|---|---|
| **Claude Code** | `.claude/skills/`, `~/.claude/skills/` | **No** — `bd init` writes a *hook*, never a skill |
| **Codex** | `.agents/skills/` | **Yes** — same skill name |

**Installing first does not protect you.** Verified: `bd init` overwrites an
existing `.agents/skills/beads/SKILL.md` silently — no prompt, no backup. The
fix is the flag, not the order.

```bash
# Claude Code — nothing to do; no conflict is possible
cd your-project && bd init

# Codex — skip the generated agent files, install yours, restore hooks by hand
cd your-project
bd init --quiet --prefix myproj --skip-agents      # .beads/ + .gitignore ONLY
mkdir -p .agents/skills && cp -r /path/to/beads-skill/skills/beads .agents/skills/
# then add .codex/hooks.json + [features] hooks = true
# exact file: skills/beads/references/10-harness-integration.md §4

# Already initialized — remove upstream's stub first
bd setup codex --remove
cp -r /path/to/beads-skill/skills/beads .agents/skills/
```

`--skip-agents` also suppresses `.codex/hooks.json`, so you lose the `bd prime`
injection until you add it back. A later `bd setup codex` or `bd init` re-run
clobbers the skill again — re-copy after any beads setup command, and check
with:

```bash
head -3 .agents/skills/beads/SKILL.md
```

If the description begins *"Use when working in a repository that uses bd or
Beads for durable project task tracking…"*, that is upstream's stub, not yours.

`bd` works identically with none of these instruction files present — they
carry no functionality.

---

## Configuration

The skill itself needs no configuration. These are the **beads-side** settings
that change how an agent behaves; all are covered in depth in
[`09-configuration.md`](skills/beads/references/09-configuration.md).

### Agent authority — the one that matters most

`bd prime` tells the agent what it may do at session close. Default is
conservative.

```bash
bd config set agent.profile conservative     # default: track work, propose commands, do not commit
bd config set agent.profile team-maintainer  # may close, commit, push, bd dolt push
BD_AGENT_PROFILE=minimal bd prime            # per-process override
```

Hard constraints always win (stealth mode, no git remote, ephemeral branch,
`no-push`), and an explicit "do not commit" outranks the profile.

### Issue quality gates

```bash
bd config set create.require-description true   # reject descriptionless beads
bd config set validation.on-create warn         # or `error`
bd lint                                         # audit existing beads
```

### Context injection

```bash
bd setup claude          # SessionStart hook → bd prime --hook-json
bd setup codex           # Codex hook lifecycle (+ upstream's stub skill)
bd config set prime.max-memories 20             # bound the memory section
bd config set prime.max-memory-chars 4000
# .beads/PRIME.md replaces bd prime's output entirely; seed it with:
bd prime --export > .beads/PRIME.md
```

### Storage mode

```bash
bd init                    # embedded (default) — .beads/embeddeddolt/, single writer
bd init --server           # external dolt sql-server — .beads/dolt/, concurrent writers
bd init --shared-server    # one server at ~/.beads/shared-server/ for all projects
```

### Project instructions

Add a beads section to `AGENTS.md` / `CLAUDE.md` so agents that never trigger
the skill still get the rules. `bd onboard` prints the canonical snippet; a
ready-made version is in
[`06-agent-playbook.md` §11](skills/beads/references/06-agent-playbook.md).

---

## How the skill is organized

The design constraint: **`SKILL.md` is loaded on every trigger; references are
not.** So the entry point carries only what changes behavior, and everything
else is one `Read` away.

`SKILL.md` contains:

1. **12 hard rules** — beads is the only tracker; create the bead before the
   code; never `bd edit`; dependency direction is *requirement*, not time; …
2. **The session loop** — orient → pick → work → finish → hand off, as runnable
   bash
3. **20 commands** covering ~95% of agent work
4. **The dependency table** — which edge types gate `bd ready`
5. **Compaction recovery** — the exact sequence to rebuild lost context
6. **An anti-pattern table** — the failure modes, with the correct move
7. **A routing table** into the twelve references

| Ask | Start at |
|---|---|
| "Set beads up in this repo" | `01`, then `10` |
| "Plan this feature" | `06` (issue standards) + `03` (edges) |
| "What should I work on?" | `SKILL.md` session loop |
| "Something is broken / `bd` refuses" | `11` |
| "Two agents / two machines" | `07` and `08` |
| "Build a repeatable pipeline" | `05` |

---

## Maintenance: the beads submodule

Upstream is checked out at [`beads/`](beads) as a **git submodule**. Only the
pointer is committed here — none of upstream's source or docs enter this repo's
history.

### Refreshing

```bash
# First checkout — run the script, don't just init the submodule by hand:
# it also applies the sparse-checkout described below.
git submodule update --init --depth 1 beads
./scripts/update-beads.sh

# Refresh to upstream main and rewrite the pin record
./scripts/update-beads.sh

# Or pin to a specific release
./scripts/update-beads.sh v1.2.2
```

`update-beads.sh` fetches upstream, checks out the requested ref, applies the
sparse-checkout, rewrites the version table in
[`BEADS_VERSION.md`](BEADS_VERSION.md) from the submodule commit,
`docs/cli-docs.pin`, and your installed `bd version` — then stages both changes
**without committing**, so you review the upstream diff before deciding what
the skill needs.

### Review loop after an update

```bash
git -C beads log --oneline <old-sha>..HEAD -- docs/ plugins/
git -C beads diff <old-sha>..HEAD -- docs/CLI_REFERENCE.md | head -200
git -C beads diff <old-sha>..HEAD -- docs/reference/configuration.md
bd version && bd --help          # ground truth beats the docs
./scripts/validate.sh
```

Then update the affected references and commit the skill change together with
the submodule bump.

### Why `beads/.claude/` is not checked out

Upstream ships `beads/.claude/skills/beads-docs/` — a skill for authoring the
**beads project's own documentation**. Claude Code discovers any
`.claude/skills/**` beneath the working directory, so leaving it materialized
injects an unrelated, similarly-named skill into every session opened in this
repo.

`update-beads.sh` de-materializes it with git sparse-checkout:

```bash
git -C beads sparse-checkout init --no-cone
git -C beads sparse-checkout set '/*' '!/.claude/'
```

Files are marked skip-worktree rather than deleted, so `git -C beads status`
stays clean and the submodule pointer is unaffected. **That config lives in
`.git/modules/beads/info/` and is not committed**, which is why the script
re-applies it every run — a fresh clone would otherwise get the skill back.

Verify:

```bash
ls -d beads/.claude    # should be: No such file or directory
ls beads/docs          # should still be there
git -C beads status    # should be clean
```

Two other `SKILL.md` files live in the submodule —
`beads/plugins/beads/skills/beads/` and
`beads/internal/templates/skills/beads/`, both named `beads`. Neither is
discovered: Claude Code only scans `.claude/skills/**`. They stay inert unless
someone points `--plugin-dir` at `beads/plugins/beads` or copies them into a
`.claude/skills/` directory.

### Validation

```bash
./scripts/validate.sh
```

Checks SKILL.md frontmatter, that every reference is routed from the routing
table, that every link and cross-reference resolves, and that the shell scripts
pass `bash -n` and `shellcheck`. Runs in CI on every push and PR; needs neither
the submodule nor a `bd` install.

---

## Version pin and known upstream drift

[`BEADS_VERSION.md`](BEADS_VERSION.md) records exactly what the skill was
written against. At the time of writing: submodule `7505e173f`
(`v1.2.1-9-g7505e173f`), docs CLI pin `v1.2.2`, binary `bd 1.2.2`.

Places where upstream's prose disagrees with what ships — **the skill follows
the binary**:

| Upstream says | Reality on 1.2.2 |
|---|---|
| `hash-ids.md`: minimum hash length is 4 | **3** (matches `configuration.md` and the binary) |
| `issues.md`: five issue types | **Nine** built-ins — adds `decision`, `spike`, `story`, `milestone` |
| `cli-reference/index.md`: 108 commands | `bd --help` lists **109** |
| `docs/index.md`: "docs are for the 1.1.0 release" | CLI docs are pinned to v1.2.2 |
| `bd sync`, `bd events`, `bd serve`, `bd reclaim`, `bd unclaim`, `bd heartbeat` | **Not in the 1.2.2 binary.** Registered in `cmd/bd/*.go` on `main`, so they should ship later. Every affected section is marked. |

---

## How this was verified

Command names, flags, and output shapes come from
`beads/docs/CLI_REFERENCE.md` at the pinned commit — which upstream generates
from `bd help --all`. Anything liable to drift was confirmed by running `bd`
against disposable workspaces:

- `bd prime`'s actual output (the source of several hard rules)
- `bd create --json` field shape
- `bd types` / `bd statuses` built-in lists
- Default hash-ID length
- Which commands exist
- What `bd init` writes, with and without `--skip-agents`
- Whether `bd init` overwrites a pre-installed skill (**it does**)
- Whether `bd setup codex --remove` cleans up (**it does**)

> **A testing gotcha worth knowing:** `bd help <unknown>` prints *"Unknown help
> topic"* and still **exits 0**, so `bd help foo && echo exists` is a false
> positive. Test with `bd foo --help 2>&1 | head -1` and look for
> `Error: unknown command`.

---

## Comparison with upstream's own skills

Beads ships three `SKILL.md` files. Only one covers the same ground.

| | Purpose | Same concept? |
|---|---|---|
| `plugins/beads/skills/beads/` | Official "use beads as an agent" skill, shipped with the Claude Code plugin. 4.8 KB entry + 15 resources (137 KB) | **Yes — direct counterpart** |
| `internal/templates/skills/beads/` | The 2.1 KB stub `bd setup codex` writes into your project. No references | Yes, but minimal |
| `.claude/skills/beads-docs/` | House style guide for authoring beads' own Mintlify docs | **No — different job** |

Against the official skill:

| | Upstream's | This one |
|---|---|---|
| Declared bd version | 0.60.0 (self-flags stale above that) | 1.2.2, pinned and recorded |
| Size | 4.8 KB + 137 KB resources | ~11 KB + ~180 KB references |
| Stale commands | `bd pour`, `bd wisp`, `bd agent` | verified against the binary |
| TodoWrite | permitted for single-session work | prohibited, per `bd prime` |
| Drift strategy | defers to `bd prime` (drifts slowly) | pinned + a refresh script (needs upkeep) |

Upstream's restraint is a legitimate design — leaning on `bd prime` means less
to go stale. This one trades that for depth and currency, which is why the
submodule and `update-beads.sh` exist.

---

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The most
valuable contributions are **drift reports**: a place where the skill says one
thing and `bd` does another. Include your `bd version` and the command output.

```bash
./scripts/validate.sh    # before opening a PR
```

| Document | For |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to propose changes, verification rules, style |
| [SUPPORT.md](SUPPORT.md) | Where to take a question — here vs. upstream beads |
| [SECURITY.md](SECURITY.md) | Reporting a destructive script or a dangerous documented command |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributor Covenant 2.1 |
| [CHANGELOG.md](CHANGELOG.md) | What changed, and the `bd` version it was verified against |
| [BEADS_VERSION.md](BEADS_VERSION.md) | The current upstream pin and known doc drift |

Note that beads bugs belong [upstream](https://github.com/gastownhall/beads/issues),
not here — this repo only documents the tool.

---

## License and attribution

This repository is [MIT licensed](LICENSE), © 2026 Mike Zupper.

Beads is independently MIT licensed, © 2025 Beads Contributors, created by
Steve Yegge — <https://github.com/gastownhall/beads>. This skill is an
independent write-up derived from that project's public documentation and
observed CLI behavior. It is **not** produced, endorsed, or reviewed by the
beads maintainers. See [NOTICE.md](NOTICE.md).

Where this skill and `bd help` disagree, `bd` is correct and the skill needs
updating.
