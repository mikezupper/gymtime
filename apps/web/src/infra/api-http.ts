import { Effect, Layer, Schema } from "effect";
import { ApiFailure, ErrorBody } from "../domain/api.js";
import { ApiClient, type HttpCall } from "../services/api.js";

const unavailable = () => new ApiFailure({ code: "network", message: "The service could not be reached. Try again.", issues: [] });
export const ApiHttp = Layer.succeed(ApiClient, {
  request: <A, I>(path: string, schema: Schema.Schema<A, I>, options: HttpCall) => Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch(path, {
        method: options.method, credentials: "same-origin", cache: "no-store", signal,
        headers: { "Content-Type": "application/json", ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}), ...(options.key ? { "Idempotency-Key": options.key } : {}) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      }), catch: unavailable,
    });
    const value: unknown = response.status === 204 ? {} : yield* Effect.tryPromise({ try: () => response.json(), catch: unavailable });
    if (!response.ok) {
      const failure = yield* Schema.decodeUnknown(ErrorBody)(value).pipe(Effect.mapError(unavailable));
      return yield* Effect.fail(new ApiFailure({ code: failure.code, message: failure.message, issues: failure.issues }));
    }
    return yield* Schema.decodeUnknown(schema)(value).pipe(Effect.mapError(() => new ApiFailure({ code: "invalid_response", message: "The server returned an unexpected response. Try again.", issues: [] })));
  }).pipe(Effect.timeoutFail({ duration: "15 seconds", onTimeout: unavailable }), Effect.withSpan("api.request")),
});
