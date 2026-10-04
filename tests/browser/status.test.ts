import { afterEach, expect, it } from "vitest";
import "../../apps/web/src/components/gymtime-status.js";

afterEach(() => document.body.replaceChildren());
it("updates a native status region when its message changes", async () => {
  const element = document.createElement("gymtime-status");
  document.body.append(element);
  await element.updateComplete;
  expect(element.shadowRoot?.querySelector('[role="status"]')?.textContent).toContain("Checking");
  element.message = "The service is connected.";
  await element.updateComplete;
  expect(element.shadowRoot?.querySelector('[role="status"]')?.textContent).toBe("The service is connected.");
});
