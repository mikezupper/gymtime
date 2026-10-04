import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("gymtime-status")
export class GymtimeStatus extends LitElement {
  @property() message = "Checking the service…";
  static override styles = css`
    @layer components {
      :host { display: block; }
      p { padding: 1rem 1.25rem; border: 1px solid var(--border); border-radius: .75rem;
        background: var(--surface-raised); color: var(--text); margin: 0; }
    }
  `;
  override render() { return html`<p role="status">${this.message}</p>`; }
}

declare global { interface HTMLElementTagNameMap { "gymtime-status": GymtimeStatus } }
