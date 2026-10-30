import { provideDrivers } from "@gyral/core";
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
} from "./commands.js";

/** The document owns one Effect runtime. Component commands own their cancellation signals. */
export const mountApplication = (root: Element) => {
  const adapter = createAdapter();
  const detach = provideDrivers(root, [
    authDriver.provide((input, { signal }) => adapter.auth(input, signal)),
    accountsDriver.provide((input, { signal }) =>
      adapter.accounts(input, signal),
    ),
    scheduleDriver.provide((_input, { signal }) => adapter.schedule(signal)),
    saveDriver.provide((input, { signal }) =>
      adapter.save(input.action, input.key, input.csrf, signal),
    ),
    previewDriver.provide((input, { signal }) =>
      adapter.preview(input, signal),
    ),
    noticesDriver.provide((input, { signal }) =>
      adapter.notices(input, signal),
    ),
    auditDriver.provide((_input, { signal }) => adapter.audit(signal)),
    publicDriver.provide((input, { signal }) =>
      adapter.publicCalendar(input, signal),
    ),
    healthDriver.provide((_input, { signal }) => adapter.health(signal)),
    guidanceDriver.provide((input, { signal }) =>
      adapter.guidance(input, signal),
    ),
    guidanceSaveDriver.provide((input, { signal }) =>
      adapter.saveGuidance(input.user, input.value, signal),
    ),
  ]);
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
