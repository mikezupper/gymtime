import { command, css, define, html } from "@gyral/core";
import { Either } from "effect";
import "../components/gymtime-status.js";
import { healthDriver, type Result } from "../runtime/commands.js";
type State = { readonly status: "Checking" | "Connected" | "Unavailable" };
type Msg =
  | { readonly _tag: "Check" }
  | { readonly _tag: "Checked"; readonly result: Result<"health"> }
  | { readonly _tag: "Failed" };
const check = () =>
  command(healthDriver, undefined, {
    key: "health",
    concurrency: "switch",
    onSuccess: (result): Msg => ({ _tag: "Checked", result }),
    onFailure: (): Msg => ({ _tag: "Failed" }),
  });
export const GymtimeConnection = define<State, Msg>()("gymtime-connection", {
  init: () => [{ status: "Checking" }, [check()]],
  styles: css`
    @layer components {
      :host {
        display: block;
        max-inline-size: 48rem;
      }
      h1 {
        font-size: clamp(2rem, 6vw, 3.5rem);
        line-height: 1.1;
        letter-spacing: -0.035em;
      }
      p {
        line-height: 1.65;
        max-inline-size: 60ch;
      }
      button {
        font: inherit;
        min-block-size: 44px;
        padding-inline: 1.25rem;
        margin-block: 1rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--surface-raised);
        color: var(--text);
        cursor: pointer;
      }
      :focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
    }
  `,
  intent: { Check: true },
  update: {
    Check: () => [{ status: "Checking" }, [check()]],
    Checked: (_s, m) => ({
      status: Either.isRight(m.result) ? "Connected" : "Unavailable",
    }),
    Failed: () => ({ status: "Unavailable" }),
  },
  view: (s, i) =>
    html`<gymtime-status
        .message=${s.status === "Checking"
          ? "Checking the service…"
          : s.status === "Connected"
            ? "The service and database are connected."
            : "The service could not be reached. Try again."}
      ></gymtime-status
      ><button data-intent=${i.Check}>Check connection again</button>`,
});
