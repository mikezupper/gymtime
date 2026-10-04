import { provide } from "@lit/context";
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createAdapter } from "./runtime/adapter.js";
import { adapterContext } from "./state/context.js";
import "./pages/gymtime-team-calendar.js";
import "./pages/gymtime-sign-in.js";
import "./pages/gymtime-account.js";

@customElement("gymtime-app")
export class GymtimeApp extends LitElement {
  @property() view: "sign-in" | "team" | "app" = "app";
  @provide({ context: adapterContext }) readonly adapter = createAdapter();
  // Light DOM keeps document landmarks and native skip-link targets addressable.
  override createRenderRoot() { return this; }
  override disconnectedCallback() {
    super.disconnectedCallback();
    void this.adapter.dispose();
  }
  override render() {
    return html`<header><a class="skip" href="#main">Skip to content</a><nav aria-label="Primary"><a href="/"><strong translate="no">Gymtime</strong></a><a href="/app">Gym workspace</a></nav></header>
      <main id="main" tabindex="-1">${this.view === "sign-in" ? html`<gymtime-sign-in></gymtime-sign-in>` : this.view === "app" ? html`<gymtime-account></gymtime-account>` : html`<gymtime-team-calendar .token=${window.location.pathname.split("/")[2]??""}></gymtime-team-calendar>`}</main>`;
  }
}
declare global { interface HTMLElementTagNameMap { "gymtime-app": GymtimeApp } }
