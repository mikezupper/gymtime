import { Effect, Layer, Schema } from "effect";
import { Health, HealthError } from "../domain/health.js";
import { HealthApi } from "../services/health.js";

export const HealthHttp = Layer.succeed(HealthApi, {
  ready: Effect.gen(function* () {
    const response = yield* Effect.tryPromise({ try: (signal) => fetch("/health/ready", { signal, credentials: "same-origin", cache: "no-store" }),
      catch: () => new HealthError({ reason: "network" }) });
    if (!response.ok) return yield* Effect.fail(new HealthError({ reason: "response" }));
    const data: unknown = yield* Effect.tryPromise({ try: () => response.json(), catch: () => new HealthError({ reason: "decode" }) });
    return yield* Schema.decodeUnknown(Health)(data).pipe(Effect.mapError(() => new HealthError({ reason: "decode" })));
  }).pipe(Effect.timeoutFail({ duration: "10 seconds", onTimeout: () => new HealthError({ reason: "network" }) }), Effect.withSpan("health.ready")),
});
