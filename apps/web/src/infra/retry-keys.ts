import { Effect, Layer } from "effect";
import { ApiFailure } from "../domain/api.js";
import { RetryKeys } from "../services/retry-keys.js";
export const BrowserRetryKeys = Layer.succeed(RetryKeys, { create: Effect.try({ try: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join(""), catch: () => new ApiFailure({ code: "unavailable", message: "Your browser could not create a retry key. Reload and try again.", issues: [] }) }) });
