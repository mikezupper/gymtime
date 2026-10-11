# Gyral 0.3.1-next.9

These are the nine unchanged package archives from the owner's local
`gyral-tarballs/release-0.3.1-next.9` release. They are vendored because this
prerelease is not available from npm. A fresh clone has the release artifacts
without needing that sibling directory.

[SOURCE.json](SOURCE.json) records version `0.3.1-next.9`, clean source commit
`78052c439d697e5d2075bd6a40c6ea8cc257cd6c`, and the upstream packing timestamp.
[SHA256SUMS](SHA256SUMS) is the unchanged upstream checksum manifest, covering
all nine archives and `SOURCE.json`.

| Package | Use in Gymtime |
| --- | --- |
| `@gyral/core` | Model-View-Intent components, stores, drivers, templates, Vite preset, ESLint rules, and element typings |
| `@gyral/ssr` | Build-time landing-page rendering; request-time rendering if selected later |
| `@gyral/router` | Browser route ownership, navigation, scroll, and focus |
| `@gyral/http` | Optional HTTP driver; existing Effect transport already supplies typed workflows |
| `@gyral/time` | Lifecycle-managed timers when needed |
| `@gyral/testing` | DOM-free model tests and browser driver fakes |
| `@gyral/devtools` | Development-only inspection |
| `@gyral/mcp` | Local API, documentation, and skill reference for agents |
| `create-gyral` | Reference scaffolding; do not run it over the existing app |

The [Gyral frontend](../../../docs/gyral-rewrite.md) installs core, SSR, and testing from these archives.
Keeping optional packages here does not require adding them to the application bundle.
Archive contents retain their upstream notices; package manifests declare MIT licensing.

## Verify the release

From the repository root:

```bash
pnpm vendor:check
```

Or directly:

```bash
cd vendor/gyral/0.3.1-next.9
sha256sum --strict --check SHA256SUMS
```

Checksum verification detects changes relative to the supplied release manifest;
it is not a signature or independent proof of the upstream author's identity.

## Dependency installation

Use exact `file:` dependencies. In `apps/web/package.json`, core's path is
`file:../../vendor/gyral/0.3.1-next.9/gyral-core-0.3.1-next.9.tgz`.
Root workspace overrides must point satellite dependencies at the same vendored
core, using paths relative to the repository root. Gyral satellites require exact
core `0.3.1-next.9`; without that override, a package manager can try npm.

Regenerate `pnpm-lock.yaml`, then verify a frozen install and one resolved core.
Docker must copy `vendor/` before installing the frozen lockfile. Docker verifies the archive checksums before its frozen install.

Read the package declarations and the supplied release's docs before writing
Gyral code. Use the exact release guidance shipped inside the MCP archive.

The matching agent guidance is inside the MCP corpus. Read its entrypoint without installing a global package:

```bash
tar -xOf vendor/gyral/0.3.1-next.9/gyral-mcp-0.3.1-next.9.tgz package/dist/corpus.json | node --input-type=module -e 'import {readFileSync} from "node:fs"; const corpus=JSON.parse(readFileSync(0,"utf8")); process.stdout.write(corpus.skill.find(entry=>entry.path==="SKILL.md").content)'
```

The same `skill` array contains the linked `references/` documents. Read the relevant entries with the same exact release instead of applying an earlier prerelease’s APIs.

Switching to a published final release is a separate dependency change: verify
its artifacts and API, replace the `file:` dependencies, regenerate the lockfile,
and rerun the application and container checks before removing this directory.
