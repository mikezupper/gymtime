# Contributing

Thanks for helping keep this skill accurate.

## The most valuable contribution: drift reports

This skill documents a moving target. The single most useful thing you can
report is a place where **the skill says one thing and `bd` does another**.

Open an issue with:

```bash
bd version          # which binary you are on
bd <command> --help # what the CLI actually says
```

plus a quote of the skill text that disagrees. Small, specific reports are
easier to act on than "chapter 7 is out of date".

## Ground rules for changes

1. **The binary wins.** Upstream's prose docs live on `main` and describe
   unreleased behavior. Where `docs/` and the shipping `bd` disagree, the skill
   follows `bd`, and the conflict gets recorded in `BEADS_VERSION.md`.
2. **Verify before you write.** If you are documenting a command, run it. Note
   that `bd help <unknown>` exits **0** while printing "Unknown help topic" —
   test existence with `bd foo --help 2>&1 | head -1` and look for
   `Error: unknown command`.
3. **Experiment in a temp directory, never a real workspace:**
   ```bash
   d=$(mktemp -d); ( cd "$d" && git init -q && bd init --quiet --prefix test ); rm -rf -- "$d"
   ```
4. **Keep `SKILL.md` lean.** It loads on every trigger. New detail belongs in a
   reference; `SKILL.md` changes only when the *behavior* an agent should adopt
   changes.
5. **Keep references exhaustive.** They are read on demand, so completeness
   beats brevity there.
6. **Do not commit anything from `beads/`.** It is a submodule; only the
   pointer is tracked.

## Before opening a PR

```bash
./scripts/validate.sh
```

This checks the frontmatter, that every reference is routed from `SKILL.md`,
that every link and cross-reference resolves, and that the shell scripts pass
`bash -n` and `shellcheck`. CI runs the same script plus a repo-wide relative
link check.

## Updating the upstream pin

```bash
./scripts/update-beads.sh            # or: ./scripts/update-beads.sh v1.3.0
git -C beads log --oneline <old>..HEAD -- docs/ plugins/
git -C beads diff <old>..HEAD -- docs/CLI_REFERENCE.md | head -200
```

Then update the affected references and commit the skill change **together
with** the submodule bump, so the pin and the prose never disagree.

## Style

- Prose over bullet soup where a sentence explains a cause.
- Every command example should be copy-pasteable and correct as written.
- Mark anything not present in the pinned `bd` version with an explicit
  callout — do not silently omit it, since it usually ships later.
- Tables for reference material; numbered steps for procedures.

## Scope

In scope: anything that makes an agent use beads correctly.

Out of scope: patches to beads itself (send those to
[gastownhall/beads](https://github.com/gastownhall/beads)), and forks of this
skill tailored to a private workflow — keep those in your own copy.
