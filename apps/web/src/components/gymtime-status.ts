import {
  css,
  define,
  html,
  prop,
  type PropsOf,
  type Stateless,
} from "@gyral/core";
const props = { message: prop.string({ default: "Checking the service…" }) };
export const GymtimeStatus = define<Stateless, never, PropsOf<typeof props>>()(
  "gymtime-status",
  {
    props,
    styles: css`
      @layer components {
        :host {
          display: block;
        }
        p {
          padding: 1rem 1.25rem;
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          background: var(--surface-raised);
          color: var(--text);
          margin: 0;
        }
      }
    `,
    view: (_s, _i, { props: p }) => html`<p role="status">${p.message}</p>`,
  },
);
