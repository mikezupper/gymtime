import { Effect } from "effect";
import { command, run } from "./system.js";

const verification = Effect.gen(function* () {
  for (const script of ["check", "test:unit", "test:browser", "test:e2e", "build"] as const) {
    yield* Effect.log(`Local verification: pnpm ${script}`);
    const output = yield* command("pnpm", [script]);
    if (output.trim()) yield* Effect.log(output.trim());
  }
  yield* Effect.log("Local verification: production container build");
  const output = yield* command("docker", ["build", "--platform", "linux/amd64", "--tag", "gymtime:verification",
    "--build-arg", "PUBLIC_SITE_URL=https://gym.example.test", "."]);
  if (output.trim()) yield* Effect.log(output.trim());
  yield* Effect.log("Local verification passed. No image was pushed or application deployed.");
}).pipe(Effect.withSpan("local-verification"));

run(verification);
