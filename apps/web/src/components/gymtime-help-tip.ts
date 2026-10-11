import { css, define, html, prop, type PropsOf } from "@gyral/core";
import { helpTopics, type HelpTopic } from "../domain/guidance.js";
const props = { topic: prop.string({ default: "calendar" }) };
interface State {
  readonly open: boolean;
}
type Msg = { readonly _tag: "Toggled"; readonly open: boolean };
const topic = (value: string): HelpTopic =>
  value in helpTopics
    ? (Object.keys(helpTopics).find((key): key is HelpTopic => key === value) ??
      "calendar")
    : "calendar";
export const GymtimeHelpTip = define<State, Msg, PropsOf<typeof props>>()(
  "gymtime-help-tip",
  {
    props,
    init: () => ({ open: false }),
    styles: css`
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
    `,
    intent: {
      Toggled: ({ newState }) =>
        newState ? { _tag: "Toggled", open: newState === "open" } : undefined,
    },
    update: { Toggled: (_s, m) => ({ open: m.open }) },
    view: (s, i, { props: p }) => {
      const content = helpTopics[topic(p.topic)];
      return html`<button
          type="button"
          aria-label=${"Help: " + content.title}
          aria-expanded=${s.open ? "true" : "false"}
          popovertarget="explanation"
        >
          ?
        </button>
        <div
          id="explanation"
          popover="auto"
          data-intent=${i.Toggled}
          data-intent-on="toggle"
        >
          <strong>${content.title}</strong>
          <p>${content.text}</p>
        </div>`;
    },
  },
);
