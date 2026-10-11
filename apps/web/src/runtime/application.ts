import { defineDriver, provideDrivers, type Driver } from "@gyral/core";
import type { ApiFailure } from "../domain/api.js";
import { createAdapter } from "./adapter.js";
import {
  accountsDriver,
  auditDriver,
  authDriver,
  guidanceDriver,
  guidanceSaveDriver,
  healthDriver,
  noticesDriver,
  previewDriver,
  publicDriver,
  saveDriver,
  scheduleDriver,
  unexpected,
} from "./commands.js";

/** The document owns one Effect runtime. Component commands own their cancellation signals. */
export const mountApplication = (root: Element) => {
  const adapter = createAdapter();
  const implement = <I, O>(
    token: Driver<I, O, ApiFailure>,
    run: Driver<I, O, ApiFailure>["run"],
  ) => defineDriver({ name: token.name, run, toError: unexpected });
  const detach = provideDrivers(root, {
    [authDriver.name]: implement(authDriver, (input, { signal }) =>
      adapter.auth(input, signal),
    ),
    [accountsDriver.name]: implement(accountsDriver, (input, { signal }) =>
      adapter.accounts(input, signal),
    ),
    [scheduleDriver.name]: implement(scheduleDriver, (_input, { signal }) =>
      adapter.schedule(signal),
    ),
    [saveDriver.name]: implement(saveDriver, (input, { signal }) =>
      adapter.save(input.action, input.key, input.csrf, signal),
    ),
    [previewDriver.name]: implement(previewDriver, (input, { signal }) =>
      adapter.preview(input, signal),
    ),
    [noticesDriver.name]: implement(noticesDriver, (input, { signal }) =>
      adapter.notices(input, signal),
    ),
    [auditDriver.name]: implement(auditDriver, (_input, { signal }) =>
      adapter.audit(signal),
    ),
    [publicDriver.name]: implement(publicDriver, (input, { signal }) =>
      adapter.publicCalendar(input, signal),
    ),
    [healthDriver.name]: implement(healthDriver, (_input, { signal }) =>
      adapter.health(signal),
    ),
    [guidanceDriver.name]: implement(guidanceDriver, (input, { signal }) =>
      adapter.guidance(input, signal),
    ),
    [guidanceSaveDriver.name]: implement(
      guidanceSaveDriver,
      (input, { signal }) =>
        adapter.saveGuidance(input.user, input.value, signal),
    ),
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    detach();
    void adapter.dispose();
    window.removeEventListener("pagehide", leaving);
  };
  const leaving = (event: PageTransitionEvent) => {
    if (!event.persisted) dispose();
  };
  window.addEventListener("pagehide", leaving);
  return dispose;
};
