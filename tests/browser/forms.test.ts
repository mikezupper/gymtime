import { afterEach, expect, it } from "vitest";
import { LitElement, html } from "lit";
import { FormErrors } from "../../apps/web/src/components/form-errors.js";
import { Revalidate } from "../../apps/web/src/components/revalidate.js";

class FormFixture extends LitElement {
  issues: ReadonlyArray<{field:string;message:string}> = [];
  refreshes = 0;
  private readonly errors = new FormErrors(this, () => this.issues);
  private readonly revalidate = new Revalidate(this, () => { this.refreshes += 1; });
  override render() {
    return html`<form @submit=${(event:SubmitEvent) => {event.preventDefault();this.errors.remember(event);}}>
      <label>Reason<input name="reason" aria-describedby="help"></label>
      <p id="help">Explain the competing request.</p><button>Submit</button>
    </form>`;
  }
}
customElements.define("gymtime-form-fixture", FormFixture);
afterEach(() => document.body.replaceChildren());

it("associates server errors with the submitted field, preserves help, and clears them on correction", async () => {
  const host = document.createElement("gymtime-form-fixture");
  document.body.append(host);
  await host.updateComplete;
  const form = host.shadowRoot?.querySelector("form");
  const input = host.shadowRoot?.querySelector("input");
  expect(form).toBeTruthy();expect(input).toBeTruthy();
  form?.dispatchEvent(new SubmitEvent("submit", {bubbles:true,cancelable:true}));
  host.issues = [{field:"reason",message:"Include a reason."}];
  host.requestUpdate();await host.updateComplete;
  expect(input?.getAttribute("aria-invalid")).toBe("true");
  expect(input?.validationMessage).toBe("Include a reason.");
  const ids = input?.getAttribute("aria-describedby")?.split(" ") ?? [];
  expect(ids).toContain("help");
  expect(ids.some(id=>host.shadowRoot?.getElementById(id)?.textContent==="Include a reason.")).toBe(true);
  input?.dispatchEvent(new Event("input", {bubbles:true,composed:true}));
  expect(input?.validationMessage).toBe("");
  expect(input?.getAttribute("aria-describedby")).toBe("help");
  expect(host.shadowRoot?.querySelector(".field-error")).toBeNull();
  host.requestUpdate();await host.updateComplete;
  expect(input?.validationMessage).toBe("");
  expect(input?.getAttribute("aria-describedby")).toBe("help");
});

it("revalidates on return and stops listening after the component disconnects", async () => {
  const host = document.createElement("gymtime-form-fixture");
  document.body.append(host);await host.updateComplete;
  const before = host.refreshes;
  window.dispatchEvent(new Event("focus"));
  expect(host.refreshes).toBe(before+1);
  host.remove();const disconnected = host.refreshes;
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(host.refreshes).toBe(disconnected);
});
declare global {interface HTMLElementTagNameMap {"gymtime-form-fixture":FormFixture}}
