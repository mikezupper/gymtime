import { Context, Effect } from "effect";
import type { ApiFailure } from "../domain/api.js";
export class RetryKeys extends Context.Tag("gymtime/RetryKeys")<RetryKeys, { readonly create: Effect.Effect<string, ApiFailure> }>() {}
export const newKey = Effect.flatMap(RetryKeys, (keys) => keys.create);
