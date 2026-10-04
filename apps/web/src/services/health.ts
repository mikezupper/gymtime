import { Context, Effect } from "effect";
import type { Health, HealthError } from "../domain/health.js";

export class HealthApi extends Context.Tag("gymtime/HealthApi")<HealthApi, {
  readonly ready: Effect.Effect<Health, HealthError>;
}>() {}

export const loadHealth = Effect.flatMap(HealthApi, (api) => api.ready);
