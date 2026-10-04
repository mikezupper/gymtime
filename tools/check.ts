import { FileSystem } from "@effect/platform";
import { Effect, Schema } from "effect";
import { resolve, dirname } from "node:path";
import { assert, command, isMain, read, run, walk } from "./system.js";
import { schema } from "./schema.js";
import { contract } from "./contracts.js";
import { checkSkills, manifest } from "./skills.js";

const Cargo = Schema.Struct({ packages: Schema.Array(Schema.Struct({ name: Schema.String,
  dependencies: Schema.Array(Schema.Struct({ name: Schema.String, kind: Schema.NullOr(Schema.String), uses_default_features: Schema.Boolean, features: Schema.Array(Schema.String) })) })) });

export const architecture = Effect.gen(function* () {
  const metadata = yield* command("cargo", ["metadata", "--no-deps", "--format-version", "1", "--locked"]).pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Cargo))));
  const allowed: Readonly<Record<string, ReadonlyArray<string>>> = {
    "gymtime-domain": [], "gymtime-app": ["gymtime-domain"], "gymtime-infra": ["gymtime-app", "gymtime-domain"],
    "gymtime-api": ["gymtime-app", "gymtime-domain"], "gymtime-server": ["gymtime-api", "gymtime-infra", "gymtime-app", "gymtime-domain"],
  };
  for (const pkg of metadata.packages) {
    for (const dep of pkg.dependencies.filter((dep) => dep.kind === null)) {
      if (dep.name.startsWith("gymtime-")) yield* assert(allowed[pkg.name]?.includes(dep.name) ?? false, `${pkg.name} cannot depend on ${dep.name}. See ARCHITECTURE.md.`);
      if (pkg.name === "gymtime-domain") {
        yield* assert(!/^(tokio|sqlx|axum|reqwest|rand|uuid|hyper)/.test(dep.name), "Domain gained an I/O or nondeterminism dependency.");
        if (dep.name === "chrono" || dep.name === "chrono-tz") yield* assert(!dep.uses_default_features && dep.features.every((feature) => feature === "std"), "Calendar dependencies must stay pure: defaults off and std only.");
      }
      if (pkg.name === "gymtime-app") yield* assert(!/^(sqlx|axum|reqwest|hyper)/.test(dep.name), "App gained a driver or framework dependency.");
    }
  }
  const files = (yield* walk("apps/web/src")).filter((path) => path.endsWith(".ts"));
  for (const path of files) {
    const text = yield* read(path);
    if (!path.includes("/runtime/")) yield* assert(!/\b(?:ManagedRuntime\.make|(?:Effect|runtime)\.run(?:Promise|Sync|Fork))\b/.test(text), `${path}: runtime execution belongs in runtime/.`);
    for (const match of text.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
      const imported = match.at(1) ?? "";
      if (path.includes("/domain/")) yield* assert(imported === "effect" || imported === "@gymtime/contracts" || imported.startsWith("./"), `${path}: domain import ${imported} crosses its boundary.`);
      if (path.includes("/components/")) yield* assert(!/\/(services|infra|runtime|state|pages)\//.test(imported), `${path}: leaf components receive properties, not services.`);
      if (path.includes("/services/")) yield* assert(!/\/(infra|runtime|pages|components)\//.test(imported), `${path}: service import crosses its boundary.`);
    }
  }
  yield* Effect.log("Architecture boundaries passed.");
});

export const docs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const files = ["README.md", "AGENTS.md", "ARCHITECTURE.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "SUPPORT.md", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md", ...(yield* walk("docs")).filter((file) => file.endsWith(".md"))];
  let count = 0;
  for (const path of files) {
    const text = yield* read(path);
    yield* assert(text.split("\n").filter((line) => /^\s*```/.test(line)).length % 2 === 0, `${path}: unmatched code fence.`);
    const body = text.replace(/```[\s\S]*?```/g, "");
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = (match.at(1) ?? "").replace(/^<|>$/g, "");
      if (/^[a-z][a-z+.-]*:/i.test(target) || target.startsWith("#")) continue;
      count += 1;
      yield* assert(yield* fs.exists(resolve(dirname(path), target.split("#").at(0) ?? "")), `${path}: missing link ${target}.`);
    }
  }
  const packageJson = yield* read("package.json").pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Schema.Struct({ scripts: Schema.Record({ key: Schema.String, value: Schema.String }) })))));
  const specification = yield* read("docs/scaffold.md");
  for (const match of specification.matchAll(/`pnpm ([a-z]+:[a-z]+|dev|check|build)`/g)) {
    yield* assert((match.at(1) ?? "") in packageJson.scripts, `Undeclared command: ${match.at(1)}`);
  }
  const configSources = (yield* Effect.forEach(["compose.yaml", "compose.dev.yaml", "crates/server/src/config.rs", "tools/dev.ts"], read, { concurrency: 2 })).join("\n");
  for (const match of (yield* read(".env.example")).matchAll(/^([A-Z][A-Z_]+)=/gm)) {
    yield* assert(configSources.includes(match.at(1) ?? ""), `Unused configuration example: ${match.at(1)}`);
  }
  const pins = yield* manifest;
  for (const pin of pins.skills) yield* assert(yield* fs.exists(`.agents/skills/${pin.name}/${pin.entry}`), `${pin.name}: entrypoint missing.`);
  yield* Effect.log(`${files.length} documents and ${count} local links passed.`);
});

const all = Effect.gen(function* () {
  for (const [binary, args] of [
    ["pnpm", ["exec", "tsc", "--noEmit"]],
    ["pnpm", ["exec", "eslint", "apps/web", "tools", "tests", "*.ts"]],
    ["pnpm", ["exec", "lit-analyzer", "apps/web/src", "--strict"]],
    ["cargo", ["fmt", "--all", "--", "--check"]],
    ["cargo", ["clippy", "--workspace", "--all-targets", "--all-features", "--locked", "--", "-D", "warnings"]],
    ["cargo", ["deny", "--log-level", "error", "check"]],
    ["cargo", ["build", "-p", "gymtime-domain", "--no-default-features", "--locked"]],
  ] as const) {
    yield* Effect.log(`Checking ${binary} ${args.join(" ")}`);
    const output = yield* command(binary, args);
    if (output.trim()) yield* Effect.log(output.trim());
  }
  yield* architecture;
  yield* contract("check");
  yield* schema(true);
  yield* docs;
  yield* checkSkills(false);
});

if (isMain(import.meta.url)) run(process.argv.at(2) === "docs" ? docs : process.argv.at(2) === "architecture" ? architecture : all);
