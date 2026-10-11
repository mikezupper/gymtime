import { prop } from "@gyral/core";
import { Schema } from "effect";
import { Session } from "../domain/api.js";
import { GuidancePreferences, initialGuidance } from "../domain/guidance.js";
import { Schedule } from "../domain/schedule.js";

export const scheduleProp = () => prop.value(Schema.standardSchemaV1(Schedule));
export const sessionProp = () => prop.value(Schema.standardSchemaV1(Session));
export const preferencesProp = () =>
  prop.value(Schema.standardSchemaV1(GuidancePreferences), {
    default: initialGuidance,
  });
export const numbersProp = () =>
  prop.value(Schema.standardSchemaV1(Schema.Array(Schema.Number)), {
    default: [],
  });
export type Issue = { readonly field: string; readonly message: string };
export const noIssues: ReadonlyArray<Issue> = [];
export const issuesProp = () =>
  prop.value(
    Schema.standardSchemaV1(
      Schema.Array(
        Schema.Struct({ field: Schema.String, message: Schema.String }),
      ),
    ),
    { default: noIssues },
  );

export const idFrom = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};
