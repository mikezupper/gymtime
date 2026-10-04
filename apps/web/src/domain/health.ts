import { Data, Schema } from "effect";
import type { components } from "@gymtime/contracts";

export const Health = Schema.Struct({ status: Schema.Literal("alive", "ready") });
export type Health = typeof Health.Type;
const contractType: Health extends components["schemas"]["HealthResponse"] ? true : never = true;
export const healthContractCompatible = contractType;

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly reason: "network" | "response" | "decode";
}> {}
