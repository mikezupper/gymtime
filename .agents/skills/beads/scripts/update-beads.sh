#!/usr/bin/env bash
# Update the beads reference submodule to upstream main and refresh the pin
# record in BEADS_VERSION.md.
#
#   ./scripts/update-beads.sh          # fast-forward beads/ to origin/main
#   ./scripts/update-beads.sh v1.2.2   # pin beads/ to a specific tag/commit
#
# The submodule pointer change is left staged but NOT committed, so you can
# review the upstream diff before deciding whether the skill needs updating.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || exit 1

ref="${1:-main}"

if [ ! -e beads/.git ]; then
  echo "beads/ submodule is not checked out; running git submodule update --init"
  git submodule update --init --depth 1 beads
fi

# Keep upstream's own agent config out of the working tree.
#
# beads/.claude/skills/beads-docs/ is a skill for editing the beads project's
# OWN documentation. Claude Code discovers any .claude/skills/** under the
# working directory, so leaving it checked out puts an unrelated,
# similarly-named skill in every session opened in this repo.
#
# Sparse-checkout de-materializes it without dirtying the submodule (the files
# are marked skip-worktree, so `git -C beads status` stays clean). The config
# lives in .git/modules/beads/info/ and is NOT committed, so this has to be
# re-applied on every fresh clone — which is why it runs here, every time.
echo "==> Applying sparse-checkout (excluding beads/.claude/)"
git -C beads sparse-checkout init --no-cone
git -C beads sparse-checkout set '/*' '!/.claude/'

if [ -e beads/.claude ]; then
  echo "WARNING: beads/.claude still exists; upstream's beads-docs skill will be discovered" >&2
fi

echo "==> Fetching upstream"
git -C beads fetch --tags origin

echo "==> Checking out $ref"
if git -C beads rev-parse --verify --quiet "origin/$ref" >/dev/null; then
  git -C beads checkout -q -B "$ref" "origin/$ref"
else
  git -C beads checkout -q --detach "$ref"
fi

commit="$(git -C beads rev-parse --short HEAD)"
describe="$(git -C beads describe --tags 2>/dev/null || echo 'unknown')"
docs_pin="$(grep -v '^#' beads/docs/cli-docs.pin | tr -d '[:space:]' || echo 'unknown')"
bd_version="$(bd version 2>/dev/null | head -1 || echo 'bd not installed')"
today="$(date +%Y-%m-%d)"

echo "==> Writing pin header to BEADS_VERSION.md"
tmp="$(mktemp)"
{
  cat <<EOF
# Upstream pin

The skill in \`skills/beads/\` is written and verified against the versions
recorded here. Regenerate this file with \`scripts/update-beads.sh\`.

| Field | Value |
|---|---|
| Upstream repo | https://github.com/gastownhall/beads |
| Submodule path | \`beads/\` |
| Submodule commit | \`$commit\` |
| \`git describe\` | \`$describe\` |
| Docs CLI pin (\`docs/cli-docs.pin\`) | \`$docs_pin\` |
| \`bd\` binary verified against | \`$bd_version\` |
| Date written | $today |
EOF
  # Preserve everything from the first prose section onward.
  echo
  awk 'f{print} /^## What "verified against" means/{print; f=1}' BEADS_VERSION.md
} >"$tmp"
mv "$tmp" BEADS_VERSION.md

git add beads BEADS_VERSION.md

cat <<EOF

==> beads/ is now at $commit ($describe)
    docs CLI pin: $docs_pin
    local bd:     $bd_version

Review what changed upstream before trusting the skill:

  git -C beads log --oneline <old-sha>..$commit -- docs/ plugins/
  git -C beads diff <old-sha>..$commit -- docs/CLI_REFERENCE.md | head -200

Then update skills/beads/ where the docs moved, and commit both together.
EOF
