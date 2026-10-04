import { it, expect } from "vitest";
import { Effect } from "effect";
import { Error as PlatformError, FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { replaceSkill, validateReferences } from "../../tools/skills.js";

it("restores copied instructions and their pin when manifest replacement fails", async () => {
  await Effect.runPromise(Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const base = yield* fs.makeTempDirectoryScoped({ prefix: "gymtime-skill-test-" });
    const target = `${base}/current`; const copy = `${base}/prepared`; const manifestPath = `${base}/lock.json`;
    yield* fs.makeDirectory(target); yield* fs.makeDirectory(copy);
    yield* fs.writeFileString(`${target}/SKILL.md`, "old instructions");
    yield* fs.writeFileString(`${copy}/SKILL.md`, "new instructions");
    yield* fs.writeFileString(manifestPath, "old pin");
    const fault = FileSystem.FileSystem.of({ ...fs, rename: (from, to) => to === manifestPath
      ? Effect.fail(new PlatformError.SystemError({ module: "FileSystem", method: "rename", reason: "PermissionDenied" }))
      : fs.rename(from, to) });
    const result = yield* Effect.either(replaceSkill({ target, copy, backup: `${base}/backup`, manifestPath,
      stagedManifest: `${base}/prepared-lock.json`, original: "old pin", next: "new pin" }).pipe(Effect.provideService(FileSystem.FileSystem, fault)));
    expect(result._tag).toBe("Left");
    expect(yield* fs.readFileString(`${target}/SKILL.md`)).toBe("old instructions");
    expect(yield* fs.readFileString(manifestPath)).toBe("old pin");
    expect(yield* fs.exists(`${base}/backup`)).toBe(false);
  }).pipe(Effect.scoped, Effect.provide(NodeContext.layer)));
});

it("rejects broken or escaping references before replacing instructions", async () => {
  await Effect.runPromise(Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const base = yield* fs.makeTempDirectoryScoped({ prefix: "gymtime-skill-reference-" });
    for (const link of ["missing.md", "../outside.md"]) {
      yield* fs.writeFileString(`${base}/SKILL.md`, `[Reference](${link})`);
      const result = yield* Effect.either(validateReferences(base, "SKILL.md"));
      expect(result._tag).toBe("Left");
    }
  }).pipe(Effect.scoped, Effect.provide(NodeContext.layer)));
});
