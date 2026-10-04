# Security Policy

## Scope

This repository contains **documentation only** — markdown files that make up
an agent skill, plus two small maintenance shell scripts. It ships no
application code, no service, and no runtime dependencies.

That said, two things here are worth reporting if they go wrong:

| Area | Example of a reportable issue |
|---|---|
| `scripts/*.sh` | A command injection, an unquoted expansion that could delete outside the repo, or anything destructive when run in an unexpected directory |
| Skill content | A documented command that would cause data loss if an agent followed it as written — e.g. a destructive `bd` invocation presented without its safety flag |

The second category matters more than it looks. Agents execute what this skill
tells them to, so a wrong `--force` in an example is a real hazard, not a typo.

## Not in scope

Vulnerabilities in **beads (`bd`) itself** belong upstream:
<https://github.com/gastownhall/beads/security> — this repo only documents that
tool and vendors none of its code.

The `beads/` git submodule references upstream by URL and commit; its contents
are never committed here.

## Reporting

Report privately via
[GitHub Security Advisories](https://github.com/mikezupper/beads-skill/security/advisories/new),
or by email to <me@mikezupper.com>.

Please include:

- the file and line,
- what an agent or user would do as a result,
- and the concrete impact (data loss, credential exposure, arbitrary command
  execution).

This is a personal project maintained on a best-effort basis. Expect an
acknowledgement within a week. Anything that could destroy a user's issue
database gets priority.

## Supported versions

Only the latest `main` is maintained. Tagged releases are historical markers,
not maintenance branches.
