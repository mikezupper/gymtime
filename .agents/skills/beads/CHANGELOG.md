# Changelog

All notable changes to this skill are documented here. Entries record both
skill changes and the upstream beads version they were verified against.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

## [0.1.0] — 2026-08-15

Initial release.

**Verified against:** beads submodule `7505e173f` (`v1.2.1-9-g7505e173f`),
docs CLI pin `v1.2.2`, binary `bd 1.2.2`.

### Added

- `skills/beads/SKILL.md` — entry point: 12 hard rules, the session loop, the
  20 highest-value commands, dependency semantics, compaction recovery, an
  anti-pattern table, and a routing table.
- Twelve reference files covering installation and `bd init`, core concepts,
  dependencies and ready work, the full CLI, workflows (formulas, molecules,
  wisps, gates, swarms), the agent playbook, multi-agent and federation, sync
  and storage, configuration, harness integration, troubleshooting, and
  JSON/scripting.
- `scripts/update-beads.sh` — refresh the upstream submodule, apply the
  sparse-checkout, and regenerate `BEADS_VERSION.md`.
- `scripts/validate.sh` — structural validation, also run in CI.
- CI workflow: structure/shell validation plus a repo-wide relative-link check.
- `BEADS_VERSION.md` — the upstream pin and a record of known doc drift.

### Notes on upstream drift recorded at this pin

- `hash-ids.md` documents a minimum hash length of 4; the binary uses 3.
- `issues.md` lists five issue types; `bd types` reports nine built-ins.
- `cli-reference/index.md` says 108 commands; `bd --help` lists 109.
- `bd sync`, `bd events`, `bd serve`, `bd reclaim`, `bd unclaim`, and
  `bd heartbeat` are documented upstream and registered on `main`, but are not
  present in the 1.2.2 binary. Affected sections are marked rather than
  omitted.

[Unreleased]: https://github.com/mikezupper/beads-skill/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mikezupper/beads-skill/releases/tag/v0.1.0
