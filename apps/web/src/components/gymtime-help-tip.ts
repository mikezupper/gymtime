import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { helpTopics, type HelpTopic } from "../domain/guidance.js";
@customElement("gymtime-help-tip")
export class GymtimeHelpTip extends LitElement {
  @property() topic: HelpTopic = "calendar";
  @state() private open = false;
  override firstUpdated() {
    const button = this.renderRoot.querySelector("button");
    const explanation =
      this.renderRoot.querySelector<HTMLElement>("#explanation");
    if (button && explanation) button.popoverTargetElement = explanation;
  }
  static override styles = css`
    @layer help {
      :host {
        display: inline-block;
      }
      button {
        font: inherit;
        color: var(--accent);
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 50%;
        inline-size: 2.75rem;
        block-size: 2.75rem;
        cursor: pointer;
      }
      button:hover {
        background: var(--accent-subtle);
      }
      :focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
      [popover] {
        color: var(--text);
        background: var(--surface-raised);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1rem;
        inline-size: min(22rem, calc(100vw - 2rem));
        line-height: 1.6;
        box-sizing: border-box;
      }
      strong {
        display: block;
        margin-block-end: 0.5rem;
      }
      p {
        margin: 0;
      }
      @supports (position-area: block-end) {
        [popover] {
          position-area: block-end;
          position-try-fallbacks: flip-block, flip-inline;
          margin: 0.5rem;
        }
      }
    }
  `;
  override render() {
    const content = helpTopics[this.topic];
    return html`<button
        type="button"
        aria-label=${`Help: ${content.title}`}
        aria-expanded=${this.open ? "true" : "false"}
      >
        ?
      </button>
      <div
        id="explanation"
        .popover=${"auto"}
        @toggle=${(event: Event) => {
          if (event instanceof ToggleEvent)
            this.open = event.newState === "open";
        }}
      >
        <strong>${content.title}</strong>
        <p>${content.text}</p>
      </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-help-tip": GymtimeHelpTip;
  }
}
