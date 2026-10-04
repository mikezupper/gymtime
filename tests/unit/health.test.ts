import { describe, expect, it } from "vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HealthError, Health } from "../../apps/web/src/domain/health.js";
import { Schema } from "effect";
import { HealthApi, loadHealth } from "../../apps/web/src/services/health.js";

describe("health workflow", () => {
  it("uses a scoped service layer and preserves named failures", async () => {
    const runtime = ManagedRuntime.make(Layer.succeed(HealthApi, { ready: Effect.fail(new HealthError({ reason: "response" })) }));
    const result = await runtime.runPromise(Effect.either(loadHealth));
    await runtime.dispose();
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") expect(result.left.reason).toBe("response");
  });
  it("rejects malformed network status instead of treating it as ready", () => {
    expect(Schema.decodeUnknownEither(Health)({ status: "pending" })._tag).toBe("Left");
    expect(Schema.decodeUnknownEither(Health)({})._tag).toBe("Left");
  });
});
