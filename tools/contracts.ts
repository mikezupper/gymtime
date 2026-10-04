import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { command, read, write, assert, run, isMain } from "./system.js";

export const contract = (mode: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "gymtime-contract-" });
  const json = `${(yield* command("cargo", ["run", "--quiet", "--locked", "-p", "gymtime-server", "--", "--openapi"])).trim()}\n`;
  const output = `${temporary}/openapi.json`;
  yield* write(output, json);
  yield* command("pnpm", ["exec", "openapi-typescript", output, "-o", `${temporary}/index.ts`]);
  const types = yield* read(`${temporary}/index.ts`);
  if (mode === "check") {
    yield* assert(json === (yield* read("contracts/openapi.json")), "OpenAPI drift: run pnpm contract:generate.");
    yield* assert(types === (yield* read("packages/contracts/src/index.ts")), "Transport drift: run pnpm contract:generate.");
  } else {
    yield* fs.makeDirectory("contracts", { recursive: true });
    yield* fs.makeDirectory("packages/contracts/src", { recursive: true });
    yield* write("contracts/openapi.json", json);
    yield* write("packages/contracts/src/index.ts", types);
  }
  yield* Effect.log(`Contract ${mode} passed.`);
}).pipe(Effect.scoped);

if (isMain(import.meta.url)) run(contract(process.argv.at(2) ?? "check"));
