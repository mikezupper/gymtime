import { Context, Effect } from "effect";
import type {
  GuidanceFailure,
  GuidancePreferences,
} from "../domain/guidance.js";
export class GuidanceStore extends Context.Tag("gymtime/GuidanceStore")<
  GuidanceStore,
  {
    readonly read: (
      user: number,
    ) => Effect.Effect<GuidancePreferences, GuidanceFailure>;
    readonly write: (
      user: number,
      value: GuidancePreferences,
    ) => Effect.Effect<void, GuidanceFailure>;
  }
>() {}
export const readGuidance = (user: number) =>
  Effect.flatMap(GuidanceStore, (store) => store.read(user));
export const writeGuidance = (user: number, value: GuidancePreferences) =>
  Effect.flatMap(GuidanceStore, (store) => store.write(user, value));
