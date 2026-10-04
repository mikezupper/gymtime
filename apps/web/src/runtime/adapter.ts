import { Effect, Layer, ManagedRuntime } from "effect";
import { BrowserRetryKeys } from "../infra/retry-keys.js";
import {
  loadSchedule,
  prepareSave,
  previewSchedule,
  loadNotices,
  loadAudit,
  loadPublicCalendar,
  newKey,
} from "../services/schedule.js";
import type { ScheduleAction } from "../domain/schedule.js";
import { ApiHttp } from "../infra/api-http.js";
import { authenticate, manageAccounts } from "../services/api.js";
import type { AuthAction, AccountAction } from "../domain/api.js";
import { HealthHttp } from "../infra/health-http.js";
import { loadHealth } from "../services/health.js";
import { BrowserGuidance } from "../infra/guidance-store.js";
import { readGuidance, writeGuidance } from "../services/guidance.js";
import type { GuidancePreferences } from "../domain/guidance.js";

export const createAdapter = () => {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(HealthHttp, ApiHttp, BrowserRetryKeys, BrowserGuidance),
  );
  return {
    guidance: (user: number, signal: AbortSignal) =>
      runtime.runPromise(Effect.either(readGuidance(user)), { signal }),
    saveGuidance: (
      user: number,
      value: GuidancePreferences,
      signal: AbortSignal,
    ) =>
      runtime.runPromise(Effect.either(writeGuidance(user, value)), { signal }),
    health: (signal: AbortSignal) =>
      runtime.runPromise(
        Effect.either(loadHealth).pipe(
          Effect.tapErrorCause(() =>
            Effect.logError("Unexpected connection failure."),
          ),
        ),
        { signal },
      ),
    auth: (action: AuthAction, signal: AbortSignal) =>
      runtime.runPromise(
        Effect.either(authenticate(action)).pipe(
          Effect.tapErrorCause(() =>
            Effect.logError("Unexpected account failure."),
          ),
        ),
        { signal },
      ),
    accounts: (action: AccountAction, signal: AbortSignal) =>
      runtime.runPromise(Effect.either(manageAccounts(action)), { signal }),
    key: (signal: AbortSignal) =>
      runtime.runPromise(Effect.either(newKey), { signal }),
    schedule: (signal: AbortSignal) =>
      runtime.runPromise(Effect.either(loadSchedule), { signal }),
    save: (
      action: ScheduleAction,
      key: string,
      csrf: string,
      signal: AbortSignal,
    ) =>
      runtime.runPromise(Effect.either(prepareSave(action, key, csrf)), {
        signal,
      }),
    preview: (action: ScheduleAction, signal: AbortSignal) =>
      runtime.runPromise(Effect.either(previewSchedule(action)), { signal }),
    notices: (failedOnly: boolean, signal: AbortSignal) =>
      runtime.runPromise(Effect.either(loadNotices(failedOnly)), { signal }),
    audit: (signal: AbortSignal) =>
      runtime.runPromise(Effect.either(loadAudit), { signal }),
    publicCalendar: (token: string, signal: AbortSignal) =>
      runtime.runPromise(Effect.either(loadPublicCalendar(token)), { signal }),
    dispose: () => runtime.dispose(),
  };
};
export type AppAdapter = ReturnType<typeof createAdapter>;
