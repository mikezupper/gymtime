import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { Either } from "effect";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { adapterContext } from "../state/context.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { HealthError } from "../domain/health.js";
import "../components/gymtime-status.js";

@customElement("gymtime-connection")
export class GymtimeConnection extends LitElement {
  @consume({ context: adapterContext }) @property({ attribute: false }) adapter?: AppAdapter;
  @property() view = "app";
  private readonly health = new Task(this, {
    args: () => [this.adapter] as const,
    task: ([adapter], { signal }) => adapter ? adapter.health(signal) : Promise.resolve(Either.left(new HealthError({ reason: "network" }))),
  });
  static override styles = css`
    @layer components {
      :host { display: block; max-inline-size: 48rem; }
      h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.1; letter-spacing: -.035em; }
      p { line-height: 1.65; max-inline-size: 60ch; }
      button { font: inherit; min-block-size: 44px; padding-inline: 1.25rem; margin-block: 1rem;
        border: 1px solid var(--border); border-radius: .5rem; background: var(--surface-raised); color: var(--text); cursor: pointer; }
      :focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    }
  `;
  override render() {
    return html`      ${this.health.render({
        initial: () => html`<gymtime-status></gymtime-status>`,
        pending: () => html`<gymtime-status></gymtime-status>`,
        complete: (result) => html`<gymtime-status .message=${result && Either.isRight(result) ? "The service and database are connected." : "The service could not be reached. Try again."}></gymtime-status>`,
        error: () => html`<gymtime-status message="The service could not be reached. Try again."></gymtime-status>`,
      })}
      <button @click=${() => this.health.run()}>Check connection again</button>`;
  }
}
declare global { interface HTMLElementTagNameMap { "gymtime-connection": GymtimeConnection } }
