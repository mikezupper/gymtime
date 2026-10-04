import { Effect, Layer, Schema } from "effect";
import {
  GuidanceFailure,
  GuidancePreferences,
  initialGuidance,
} from "../domain/guidance.js";
import { GuidanceStore } from "../services/guidance.js";
const failure = () =>
  new GuidanceFailure({
    message:
      "Help preferences could not be saved in this browser. You can still use the guides; saved gym and season settings are unchanged.",
  });
const key = (user: number) => `gymtime:guidance:v1:${user}`;
export const BrowserGuidance = Layer.succeed(GuidanceStore, {
  read: (user) =>
    Effect.try({
      try: () => localStorage.getItem(key(user)),
      catch: failure,
    }).pipe(
      Effect.flatMap((value) =>
        value === null
          ? Effect.succeed(initialGuidance)
          : Schema.decodeUnknown(Schema.parseJson(GuidancePreferences))(
              value,
            ).pipe(Effect.mapError(failure)),
      ),
    ),
  write: (user, value) =>
    Schema.encode(Schema.parseJson(GuidancePreferences))(value).pipe(
      Effect.mapError(failure),
      Effect.flatMap((encoded) =>
        Effect.try({
          try: () => localStorage.setItem(key(user), encoded),
          catch: failure,
        }),
      ),
    ),
});
