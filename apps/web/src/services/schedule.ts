import { newKey } from "./retry-keys.js";
import { Effect, Schema, Schedule as Retry } from "effect";
import { ApiClient } from "./api.js";
import { Schedule, Outcome, Preview, Notices, Audit, PublicCalendar, type ScheduleAction } from "../domain/schedule.js";
export { newKey } from "./retry-keys.js";
export const loadSchedule = Effect.flatMap(ApiClient, (client) => client.request("/api/v1/schedule", Schedule, { method: "GET" })).pipe(Effect.withSpan("schedule.read"));
export const saveSchedule = (action: ScheduleAction, key: string, csrf: string) => Effect.gen(function* () {
  const client = yield* ApiClient;
  const outcome = yield* client.request("/api/v1/schedule/actions", Outcome, { method: "POST", body: action, csrf, key }).pipe(Effect.retry({ while: (e) => e.code === "network", schedule: Retry.jittered(Retry.intersect(Retry.recurs(1), Retry.exponential("250 millis"))) }));
  return { outcome, schedule: yield* loadSchedule };
}).pipe(Effect.withSpan("schedule.save",{attributes:{operation:action.operation}}));
export const previewSchedule = (action: ScheduleAction) => Effect.flatMap(ApiClient, (client) => client.request("/api/v1/schedule/preview", Preview, { method: "POST", body: action })).pipe(Effect.withSpan("schedule.preview",{attributes:{operation:action.operation}}));
export const loadNotices = (failedOnly: boolean) => Effect.flatMap(ApiClient, (client) => client.request(`/api/v1/notifications?failed_only=${String(failedOnly)}`, Notices, { method: "GET" })).pipe(Effect.withSpan("schedule.read"));
export const loadAudit = Effect.flatMap(ApiClient, (client) => client.request("/api/v1/audit", Audit, { method: "GET" })).pipe(Effect.withSpan("schedule.read"));
export const loadPublicCalendar = (token: string) => Effect.flatMap(ApiClient, (client) => client.request(`/api/v1/public/teams/${encodeURIComponent(token)}`, PublicCalendar, { method: "GET" })).pipe(Effect.withSpan("schedule.read"));
export const empty = Schema.Struct({});

export const prepareSave = (action: ScheduleAction, previousKey: string, csrf: string) => Effect.gen(function* () {
  const key = previousKey || (yield* newKey);
  return { key, result: yield* Effect.either(saveSchedule(action, key, csrf)) };
});
