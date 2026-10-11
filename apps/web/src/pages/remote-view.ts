import { nothing, type ChildValue } from "@gyral/core";
import { Match } from "effect";
import type { ApiFailure } from "../domain/api.js";
export type Remote<A> =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Ready"; readonly value: A }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
export const remoteView = <A>(
  value: Remote<A>,
  views: {
    readonly idle?: () => ChildValue;
    readonly loading?: () => ChildValue;
    readonly ready?: (value: A) => ChildValue;
    readonly failed?: (failure: ApiFailure) => ChildValue;
  },
): ChildValue => {
  return Match.value(value).pipe(
    Match.tag("Idle", () => views.idle?.() ?? nothing),
    Match.tag("Loading", () => views.loading?.() ?? nothing),
    Match.tag("Ready", ({ value }) => views.ready?.(value) ?? nothing),
    Match.tag("Failed", ({ failure }) => views.failed?.(failure) ?? nothing),
    Match.exhaustive,
  );
};
