import { dirname, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { FileSystem } from "@effect/platform";
import { Effect, Schema } from "effect";
import { assert, command, read, run, ToolError, walk, write, isMain } from "./system.js";

const Pin = Schema.Struct({
  name: Schema.String.pipe(Schema.pattern(/^[a-z][a-z-]*$/)),
  repository: Schema.String,
  sourceDirectory: Schema.Literal("."),
  sourceEntry: Schema.String,
  entry: Schema.String,
  revision: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{40}$/)),
  tag: Schema.NullOr(Schema.String),
  branch: Schema.String,
  updatePolicy: Schema.Literal("release-or-branch"),
  licenseFiles: Schema.Array(Schema.String),
  licenseStatus: Schema.Literal("declared", "not-declared"),
  files: Schema.Record({ key: Schema.String, value: Schema.String }),
});
const Manifest = Schema.Struct({ version: Schema.Literal(1), skills: Schema.Array(Pin) });
type Pin = typeof Pin.Type;
const digest = (content: string) => createHash("sha256").update(content).digest("hex");

export const manifest = read("skills.lock.json").pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Manifest))),
  Effect.mapError(() => new ToolError({ operation: "manifest", detail: "skills.lock.json is invalid." })));

export const verifyPin = (pin: Pin) => Effect.gen(function* () {
  const base = `.agents/skills/${pin.name}`;
  const paths = yield* walk(base);
  yield* assert(paths.length === Object.keys(pin.files).length, `${pin.name}: unexpected or missing copied files.`);
  yield* Effect.forEach(Object.entries(pin.files), ([path, hash]) => Effect.gen(function* () {
    yield* assert(!path.startsWith("/") && !path.split("/").includes(".."), `${pin.name}: unsafe manifest path.`);
    yield* assert(digest(yield* read(`${base}/${path}`)) === hash, `${pin.name}: local edits in ${path}; resolve them before updating.`);
  }), { concurrency: 4, discard: true });
});

const upstreamCommand = (binary: string, args: ReadonlyArray<string>, cwd = ".") => command(binary, args, cwd).pipe(
  Effect.timeoutFail({ duration: "2 minutes", onTimeout: () => new ToolError({ operation: "upstream", detail: `${binary} timed out; the selected pin is unchanged.` }) }));

const refs = (text: string) => text.trim().split("\n").flatMap((line) => {
  const parts = line.split(/\s+/);
  const sha = parts.at(0); const ref = parts.at(1);
  return sha && ref ? [{ sha, ref }] : [];
});

const latest = (pin: Pin) => Effect.gen(function* () {
  const remote = refs(yield* upstreamCommand("git", ["ls-remote", pin.repository, `refs/heads/${pin.branch}`, "refs/tags/*"]));
  const github = /^(?:git@github\.com:|https:\/\/github\.com\/)([^\s]+)\.git$/.exec(pin.repository)?.at(1);
  // gh uses the developer's existing authentication; no token is stored in the manifest.
  const release = github ? yield* Effect.either(upstreamCommand("gh", ["api", `repos/${github}/releases/latest`, "--jq", ".tag_name"])) : undefined;
  if (release && release._tag === "Right") {
    const tag = release.right.trim();
    const item = remote.find((item) => item.ref === `refs/tags/${tag}^{}`) ?? remote.find((item) => item.ref === `refs/tags/${tag}`);
    yield* assert(Boolean(item), `${pin.name}: release tag could not be resolved.`);
    if (item) return { revision: item.sha, source: `release ${tag}` };
  }
  const branch = remote.find((item) => item.ref === `refs/heads/${pin.branch}`);
  if (!branch) return yield* Effect.fail(new ToolError({ operation: "upstream", detail: `${pin.name}: configured branch is missing.` }));
  return { revision: branch.sha, source: `branch ${pin.branch}; no accessible release was returned` };
});

export const checkSkills = (online: boolean) => Effect.gen(function* () {
  const data = yield* manifest;
  const results = yield* Effect.forEach(data.skills, (pin) => Effect.either(Effect.gen(function* () {
    yield* verifyPin(pin);
    if (!online) return `${pin.name}: pin verified`;
    const available = yield* latest(pin);
    return `${pin.name}: ${available.revision === pin.revision ? "current" : `update ${pin.revision.slice(0, 8)} → ${available.revision.slice(0, 8)}`} (${available.source})`;
  })), { concurrency: 2 });
  for (const result of results) {
    if (result._tag === "Right") yield* Effect.log(result.right);
    else yield* Effect.logError(result.left.detail);
  }
  yield* assert(results.every((result) => result._tag === "Right"), "Some skill checks failed; no files were changed.");
});

export const validateReferences = (base: string, entry: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = resolve(base);
  const visited = new Set<string>();
  const inspect = (path: string): Effect.Effect<void, ToolError, FileSystem.FileSystem> => Effect.gen(function* () {
    if (visited.has(path)) return;
    visited.add(path);
    const body = (yield* read(path)).replace(/```[\s\S]*?```/g, "");
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = (match.at(1) ?? "").replace(/^<|>$/g, "");
      if (/^[a-z][a-z+.-]*:/i.test(link) || link.startsWith("#")) continue;
      const target = resolve(dirname(path), link.split("#").at(0) ?? "");
      yield* assert(!relative(root, target).startsWith(".."), `Skill reference escapes copied package: ${link}`);
      yield* assert(yield* fs.exists(target).pipe(Effect.mapError(() => new ToolError({ operation: "reference", detail: target }))), `Missing skill reference: ${link}`);
      if (target.endsWith(".md")) yield* inspect(target);
    }
  });
  yield* inspect(resolve(root, entry));
});

interface Replacement {
  readonly target: string; readonly copy: string; readonly backup: string;
  readonly manifestPath: string; readonly stagedManifest: string;
  readonly original: string; readonly next: string;
}

export const replaceSkill = (paths: Replacement) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* write(paths.stagedManifest, paths.next);
  yield* Effect.uninterruptible(Effect.gen(function* () {
    yield* fs.rename(paths.target, paths.backup);
    const applied = yield* Effect.either(Effect.gen(function* () {
      yield* fs.rename(paths.copy, paths.target);
      yield* fs.rename(paths.stagedManifest, paths.manifestPath);
    }));
    if (applied._tag === "Left") {
      yield* fs.remove(paths.target, { recursive: true, force: true });
      yield* fs.rename(paths.backup, paths.target);
      yield* write(paths.manifestPath, paths.original);
      return yield* Effect.fail(new ToolError({ operation: "update", detail: "Update failed; restored the previous pin." }));
    }
  }));
});

export const updateSkill = (name: string, revision: string) => Effect.gen(function* () {
  yield* assert(/^[a-f0-9]{40}$/.test(revision), "Select a full 40-character commit SHA.");
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.acquireRelease(fs.makeDirectory(".agents/skills/.update.lock"), () =>
    fs.remove(".agents/skills/.update.lock", { recursive: true }).pipe(Effect.catchAll(() => Effect.void)));
  const original = yield* read("skills.lock.json");
  const data = yield* manifest;
  const pin = data.skills.find((pin) => pin.name === name);
  if (!pin) return yield* Effect.fail(new ToolError({ operation: "update", detail: "Unknown skill name." }));
  yield* verifyPin(pin);
  const staging = yield* fs.makeTempDirectoryScoped({ directory: ".agents/skills", prefix: ".update-" });
  const repo = `${staging}/source`; const copy = `${staging}/copy`; const backup = `${staging}/backup`;
  yield* upstreamCommand("git", ["clone", "--quiet", "--no-checkout", "--filter=blob:none", pin.repository, repo]);
  yield* upstreamCommand("git", ["fetch", "--quiet", "origin", revision], repo);
  yield* assert((yield* upstreamCommand("git", ["rev-parse", `${revision}^{commit}`], repo)).trim() === revision, "Selected revision is not a commit.");
  yield* fs.makeDirectory(copy);
  const tree = (yield* upstreamCommand("git", ["ls-tree", "-r", revision], repo)).trim().split("\n");
  const entries = yield* Effect.forEach(tree, (line) => Effect.gen(function* () {
    const [metadata, path] = line.split("\t");
    if (!metadata?.startsWith("100") || !path || path.startsWith(".git")) return [];
    yield* assert(!path.startsWith("/") && !path.split("/").includes(".."), "Unsafe upstream path.");
    yield* assert(/\.(md|txt|json|ya?ml|html|css|ts|js|sh|svg)$/.test(path) || /(^|\/)(LICENSE|COPYING)(\.[^/]+)?$/.test(path), `New upstream asset ${path} needs an explicit copy policy review.`);
    const content = yield* upstreamCommand("git", ["show", `${revision}:${path}`], repo);
    const target = `${copy}/${path}`;
    yield* fs.makeDirectory(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    yield* write(target, content);
    return [[path, digest(content)] as const];
  }), { concurrency: 4 });
  let files: Readonly<Record<string, string>> = Object.fromEntries(entries.flat());
  if (pin.sourceEntry !== pin.entry) {
    const content = yield* read(`${copy}/${pin.sourceEntry}`);
    yield* write(`${copy}/${pin.entry}`, content);
    files = { ...files, [pin.entry]: digest(content) };
  }
  yield* validateReferences(copy, pin.entry);
  yield* Effect.forEach(pin.licenseFiles, (path) => read(`${copy}/${path}`), { discard: true });
  const before = yield* read(`.agents/skills/${pin.name}/${pin.entry}`);
  const after = yield* read(`${copy}/${pin.entry}`);
  yield* Effect.log(`${pin.name}: ${pin.revision} → ${revision}`);
  if (before !== after) {
    yield* write(`${staging}/before.md`, before); yield* write(`${staging}/after.md`, after);
    yield* fs.makeDirectory(".local", { recursive: true });
    yield* upstreamCommand("git", ["diff", "--no-index", `--output=.local/${name}-instructions.diff`, `${staging}/before.md`, `${staging}/after.md`]).pipe(Effect.either);
    const diff = yield* read(`.local/${name}-instructions.diff`);
    yield* assert(diff.length > 0, "Instruction diff failed; the current pin is unchanged.");
    yield* Effect.log(`Instruction patch: .local/${name}-instructions.diff`);
  }
  yield* fs.makeDirectory(".local", { recursive: true });
  yield* write(`.local/${pin.name}-instruction-before.md`, before);
  yield* write(`.local/${pin.name}-instruction-after.md`, after);
  const next = { ...data, skills: data.skills.map((item) => item.name === name ? { ...pin, revision, tag: null, files } : item) };
  const target = `.agents/skills/${pin.name}`;
  yield* assert((yield* read("skills.lock.json")) === original, "Manifest changed during update; retry after reviewing it.");
  yield* verifyPin(pin);
  yield* replaceSkill({ target, copy, backup, manifestPath: "skills.lock.json",
    stagedManifest: `${staging}/skills.lock.json`, original, next: `${JSON.stringify(next, null, 2)}\n` });
  yield* Effect.log(`Applied ${name}; review files and .local/${name}-instruction-{before,after}.md.`);
}).pipe(Effect.scoped);

const args = process.argv.slice(2).filter((value) => value !== "--");
const mode = args.at(0);
const revisionIndex = args.indexOf("--revision");
if (isMain(import.meta.url)) run(mode === "update" ? updateSkill(args.at(1) ?? "", revisionIndex >= 0 ? args.at(revisionIndex + 1) ?? "" : "") : checkSkills(!args.includes("--offline")));
