# Support

Where to take a question, depending on what it is about.

## This skill

Something in `skills/beads/` is wrong, unclear, or out of date:

- **[Open a drift report](https://github.com/mikezupper/beads-skill/issues/new?template=drift-report.yml)**
  — the skill says one thing and `bd` does another. Include your `bd version`
  and the real command output. These are the most useful issues this repo can
  receive.
- **[Open a blank issue](https://github.com/mikezupper/beads-skill/issues/new)**
  for anything else: a gap, a confusing section, a suggestion.

Before filing, check [`BEADS_VERSION.md`](BEADS_VERSION.md) — it records the
`bd` version the skill was written against and the places where upstream's own
docs disagree with the shipping binary. Your issue may already be listed there.

## beads (`bd`) itself

This repository only *documents* beads. For the tool:

- Bugs and features: <https://github.com/gastownhall/beads/issues>
- Questions: <https://github.com/gastownhall/beads/discussions>
- Documentation: <https://beads.gascity.com/>
- Security: <https://github.com/gastownhall/beads/security>

A good rule: if the fix would change `bd`'s behavior, it belongs upstream. If it
would change what an agent is *told* to do, it belongs here.

## Installation and setup

Most setup problems are covered in the skill itself:

- [`01-installation-and-init.md`](skills/beads/references/01-installation-and-init.md)
  — installing `bd`, every `bd init` flag, and §9 on coexisting with the files
  `bd init` generates
- [`10-harness-integration.md`](skills/beads/references/10-harness-integration.md)
  — Claude Code, Codex, and MCP wiring
- [`11-troubleshooting.md`](skills/beads/references/11-troubleshooting.md)
  — `bd doctor`, safety refusals, corruption, sync failures, sandboxes

And when `bd` itself is misbehaving, start with:

```bash
bd doctor --agent
bd where
bd version
```

## Response expectations

This is a personal project maintained on a best-effort basis. Drift reports and
PRs that include verification output get handled fastest.
