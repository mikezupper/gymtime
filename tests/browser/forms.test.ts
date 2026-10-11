import { define, html, settled, type PropsOf } from "@gyral/core";
import { afterEach, expect, it } from "vitest";
import { formErrors } from "../../apps/web/src/components/form-errors.js";
import { issuesProp } from "../../apps/web/src/components/props.js";
import { revalidate } from "../../apps/web/src/runtime/commands.js";
const props = { issues: issuesProp() };
const Fixture = define<
  { readonly refreshes: number },
  { readonly _tag: "Refresh" },
  PropsOf<typeof props>
>()("gymtime-form-fixture", {
  props,
  init: () => ({ refreshes: 0 }),
  subscriptions: () => [revalidate({ _tag: "Refresh" })],
  update: { Refresh: (s) => ({ refreshes: s.refreshes + 1 }) },
  view: (s, _i, { props: p }) =>
    html`<form ${formErrors(p.issues)}>
        <label>Reason<input name="reason" aria-describedby="help" /></label>
        <p id="help">Explain the competing request.</p>
      </form>
      <output>${s.refreshes}</output>`,
});
afterEach(() => document.body.replaceChildren());
it("associates server errors with a field, preserves help, and clears them on correction", async () => {
  const host = new Fixture();
  document.body.append(host);
  await settled();
  const input = host.shadowRoot?.querySelector("input");
  expect(input).toBeTruthy();
  host.issues = [
    { field: "reason", message: "Include a reason." },
    { field: "reason", message: "Explain the conflict." },
  ];
  await settled();
  expect(input?.getAttribute("aria-invalid")).toBe("true");
  expect(input?.validationMessage).toBe(
    "Include a reason. Explain the conflict.",
  );
  const ids = input?.getAttribute("aria-describedby")?.split(" ") ?? [];
  expect(ids).toContain("help");
  expect(
    ids.some(
      (id) =>
        host.shadowRoot?.getElementById(id)?.textContent === "Include a reason. Explain the conflict.",
    ),
  ).toBe(true);
  input?.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  expect(input?.validationMessage).toBe("");
  expect(input?.getAttribute("aria-describedby")).toBe("help");
  expect(host.shadowRoot?.querySelector(".field-error")).toBeNull();
  host.send({ _tag: "Refresh" });
  await settled();
  expect(input?.validationMessage).toBe("");
  expect(input?.getAttribute("aria-describedby")).toBe("help");
});
it("revalidates on return and stops listening after disconnect", async () => {
  const host = new Fixture();
  document.body.append(host);
  await settled();
  const count = () =>
    Number(host.shadowRoot?.querySelector("output")?.textContent);
  const before = count();
  window.dispatchEvent(new Event("focus"));
  await settled();
  expect(count()).toBe(before + 1);
  host.remove();
  const disconnected = count();
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await settled();
  expect(count()).toBe(disconnected);
});
