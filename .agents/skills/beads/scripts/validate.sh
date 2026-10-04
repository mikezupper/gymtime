#!/usr/bin/env bash
# Structural validation for the beads skill. Runs in CI and locally.
#
#   ./scripts/validate.sh
#
# Checks (none of these need the submodule or a bd install):
#   1. SKILL.md has YAML frontmatter with `name` and `description`
#   2. Every references/NN-*.md is linked from SKILL.md's routing table
#   3. Every file linked from SKILL.md actually exists
#   4. Every `NN-name.md` cross-reference inside references/ resolves
#   5. Shell scripts pass `bash -n` (and shellcheck, when installed)
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || exit 1

skill_dir="skills/beads"
fail=0

err() { printf '  ✗ %s\n' "$1"; fail=1; }
ok()  { printf '  ✓ %s\n' "$1"; }

echo "==> 1. SKILL.md frontmatter"
if [ ! -f "$skill_dir/SKILL.md" ]; then
  err "$skill_dir/SKILL.md is missing"
else
  head -1 "$skill_dir/SKILL.md" | grep -qx -- '---' \
    && ok "frontmatter opens on line 1" \
    || err "SKILL.md must start with '---' on line 1"
  awk '/^---$/{n++; next} n==1' "$skill_dir/SKILL.md" | grep -q '^name:' \
    && ok "has name:" || err "frontmatter is missing 'name:'"
  awk '/^---$/{n++; next} n==1' "$skill_dir/SKILL.md" | grep -q '^description:' \
    && ok "has description:" || err "frontmatter is missing 'description:'"
fi

echo "==> 2. Every reference file is routed from SKILL.md"
for f in "$skill_dir"/references/*.md; do
  base="$(basename "$f")"
  grep -q "references/$base" "$skill_dir/SKILL.md" \
    && ok "$base is linked" \
    || err "$base exists but is not linked from SKILL.md"
done

echo "==> 3. Every link in SKILL.md resolves"
grep -o 'references/[0-9A-Za-z._-]*\.md' "$skill_dir/SKILL.md" | sort -u | while read -r rel; do
  if [ -f "$skill_dir/$rel" ]; then
    printf '  ✓ %s\n' "$rel"
  else
    printf '  ✗ broken link: %s\n' "$rel"
    exit 1
  fi
done || fail=1

echo "==> 4. Cross-references between reference files resolve"
grep -oh '`[0-9][0-9]-[a-z-]*\.md`' "$skill_dir"/references/*.md "$skill_dir/SKILL.md" 2>/dev/null \
  | tr -d '`' | sort -u | while read -r rel; do
  if [ -f "$skill_dir/references/$rel" ]; then
    printf '  ✓ %s\n' "$rel"
  else
    printf '  ✗ broken cross-reference: %s\n' "$rel"
    exit 1
  fi
done || fail=1

echo "==> 5. Shell scripts"
for s in scripts/*.sh; do
  bash -n "$s" && ok "$s parses" || err "$s has a syntax error"
done
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -S warning scripts/*.sh && ok "shellcheck clean" || err "shellcheck reported issues"
else
  echo "  – shellcheck not installed, skipping"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "FAILED" >&2
fi
exit "$fail"
