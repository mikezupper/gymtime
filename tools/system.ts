import { Command, FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Data, Effect, Stream } from "effect";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const isMain = (url: string) => {
  const entry = process.argv.at(1);
  return entry !== undefined && pathToFileURL(resolve(entry)).href === url;
};

export class ToolError extends Data.TaggedError("ToolError")<{
  readonly operation: string;
  readonly detail: string;
}> {
  override readonly message = `${this.operation}: ${this.detail}`;
}

export const command = (binary: string, args: ReadonlyArray<string>, cwd = ".") =>
  Effect.gen(function* () {
    const process = yield* Command.start(Command.make(binary, ...args).pipe(Command.workingDirectory(cwd), Command.stderr("inherit")));
    const [output, code] = yield* Effect.all([process.stdout.pipe(Stream.decodeText(), Stream.mkString), process.exitCode], { concurrency: 2 });
    if (code !== 0) return yield* Effect.fail(new ToolError({ operation: `${binary} ${args.join(" ")}`, detail: output || `Exit code ${code}; inspect the diagnostics above.` }));
    return output;
  }).pipe(Effect.scoped, Effect.mapError((error) => error instanceof ToolError ? error : new ToolError({ operation: binary, detail: "Command could not be executed." })));

export const read = (path: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.mapError(() => new ToolError({ operation: "read", detail: path })));
});

export const write = (path: string, content: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, content).pipe(Effect.mapError(() => new ToolError({ operation: "write", detail: path })));
});

export const walk = (directory: string): Effect.Effect<ReadonlyArray<string>, ToolError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = yield* fs.readDirectory(directory).pipe(Effect.mapError(() => new ToolError({ operation: "list", detail: directory })));
    const groups = yield* Effect.forEach(names, (name) => Effect.gen(function* () {
      const path = `${directory}/${name}`;
      const stat = yield* fs.stat(path).pipe(Effect.mapError(() => new ToolError({ operation: "stat", detail: path })));
      return stat.type === "Directory" ? yield* walk(path) : [path];
    }), { concurrency: 4 });
    return groups.flat();
  });

export const run = <E>(program: Effect.Effect<void, E, NodeContext.NodeContext>) =>
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));

export const assert = (condition: boolean, detail: string) => condition
  ? Effect.void : Effect.fail(new ToolError({ operation: "verify", detail }));
