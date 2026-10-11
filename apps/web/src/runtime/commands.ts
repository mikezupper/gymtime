import { command, defineDriver, subscription, type Command } from "@gyral/core";
import {
  ApiFailure,
  type AccountAction,
  type AuthAction,
} from "../domain/api.js";
import type { GuidancePreferences } from "../domain/guidance.js";
import type { ScheduleAction } from "../domain/schedule.js";
import type { AppAdapter } from "./adapter.js";

export type Result<K extends keyof AppAdapter> = AppAdapter[K] extends (
  ...args: never[]
) => infer R
  ? Awaited<R>
  : never;
export const unexpected = () =>
  new ApiFailure({
    code: "unexpected",
    message: "The service could not be reached. Try again.",
    issues: [],
  });

export const authDriver = defineDriver<AuthAction, Result<"auth">, ApiFailure>(
  "gymtime.auth",
);
export const accountsDriver = defineDriver<
  AccountAction,
  Result<"accounts">,
  ApiFailure
>("gymtime.accounts");
export const scheduleDriver = defineDriver<
  undefined,
  Result<"schedule">,
  ApiFailure
>("gymtime.schedule");
export const saveDriver = defineDriver<
  {
    readonly action: ScheduleAction;
    readonly key: string;
    readonly csrf: string;
  },
  Result<"save">,
  ApiFailure
>("gymtime.save");
export const previewDriver = defineDriver<
  ScheduleAction,
  Result<"preview">,
  ApiFailure
>("gymtime.preview");
export const noticesDriver = defineDriver<
  boolean,
  Result<"notices">,
  ApiFailure
>("gymtime.notices");
export const auditDriver = defineDriver<undefined, Result<"audit">, ApiFailure>(
  "gymtime.audit",
);
export const publicDriver = defineDriver<
  string,
  Result<"publicCalendar">,
  ApiFailure
>("gymtime.public");
export const healthDriver = defineDriver<
  undefined,
  Result<"health">,
  ApiFailure
>("gymtime.health");
export const guidanceDriver = defineDriver<
  number,
  Result<"guidance">,
  ApiFailure
>("gymtime.guidance");
export const guidanceSaveDriver = defineDriver<
  { readonly user: number; readonly value: GuidancePreferences },
  Result<"saveGuidance">,
  ApiFailure
>("gymtime.guidance-save");

const pageDriver = defineDriver<
  { readonly _tag: "Navigate"; readonly url: string },
  undefined,
  ApiFailure
>({
  name: "gymtime.page",
  run: ({ url }) => {
    window.location.assign(url);
    return undefined;
  },
  toError: unexpected,
});
export const navigate = (url: string): Command<never> =>
  command(pageDriver, { _tag: "Navigate", url });

export interface PageAddress {
  readonly origin: string;
  readonly host: string;
  readonly path: string;
}
const addressDriver = defineDriver<undefined, PageAddress, ApiFailure>({
  name: "gymtime.address",
  run: () => ({
    origin: location.origin,
    host: location.host,
    path: location.pathname,
  }),
  toError: unexpected,
});
export const address = <M>(onSuccess: (value: PageAddress) => M): Command<M> =>
  command(addressDriver, undefined, { onSuccess });

const revalidation = subscription<undefined>("gymtime.revalidation", (emit) => {
  const visible = () => {
    if (document.visibilityState === "visible") emit(undefined);
  };
  window.addEventListener("focus", visible);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("focus", visible);
    document.removeEventListener("visibilitychange", visible);
  };
});
export const revalidate = <M>(message: M): Command<M> =>
  command(revalidation, undefined, { onSuccess: () => message });
