import { command, css, define, focus, html, nothing } from "@gyral/core";
import { Either } from "effect";
import { ApiFailure, type AuthAction } from "../domain/api.js";
import { authDriver, navigate, type Result } from "../runtime/commands.js";
interface State {
  readonly phase: "email" | "code";
  readonly email: string;
  readonly notice: string;
  readonly status: "Idle" | "Working";
  readonly failure: ApiFailure | undefined;
}
type Msg =
  | { readonly _tag: "Submit"; readonly action: AuthAction }
  | { readonly _tag: "Resend" }
  | { readonly _tag: "Another" }
  | { readonly _tag: "Answered"; readonly result: Result<"auth"> }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
const request = (action: AuthAction) =>
  command(authDriver, action, {
    key: "auth",
    concurrency: "exhaust",
    onSuccess: (result): Msg => ({ _tag: "Answered", result }),
    onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
  });
export const GymtimeSignIn = define<State, Msg>()("gymtime-sign-in", {
  init: () => ({
    phase: "email",
    email: "",
    notice: "",
    status: "Idle",
    failure: undefined,
  }),
  styles: css`
    @layer components {
      :host {
        display: block;
        max-inline-size: 32rem;
      }
      h1 {
        font-size: clamp(2rem, 6vw, 3.5rem);
        letter-spacing: -0.04em;
        line-height: 1.1;
      }
      p {
        line-height: 1.65;
        margin-block: 1.2rem;
      }
      form {
        display: grid;
        gap: 1rem;
      }
      label {
        display: grid;
        gap: 0.5rem;
        font-weight: 650;
      }
      input {
        box-sizing: border-box;
        inline-size: 100%;
        min-block-size: 48px;
        font: inherit;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--surface-raised);
        color: var(--text);
      }
      button {
        min-block-size: 48px;
        font: inherit;
        padding: 0.65rem 1.2rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--accent);
        color: var(--surface);
        cursor: pointer;
      }
      button.secondary {
        background: var(--surface-raised);
        color: var(--text);
        margin-block-start: 1rem;
      }
      button:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      :focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
      [role="alert"] {
        border-inline-start: 3px solid var(--accent);
        padding-inline-start: 1rem;
      }
    }
  `,
  intent: {
    Submit: ({ formData }, { state: s }) => {
      if (!formData) return undefined;
      const email = formData.get("email");
      const code = formData.get("code");
      if (s.phase === "email")
        return typeof email === "string" && email.length > 0
          ? { _tag: "Submit", action: { type: "request", email } }
          : undefined;
      return typeof code === "string" && /^\d{6}$/.test(code)
        ? { _tag: "Submit", action: { type: "verify", email: s.email, code } }
        : undefined;
    },
    Resend: true,
    Another: true,
  },
  update: {
    Submit: (s, m) =>
      s.status === "Working"
        ? s
        : [
            {
              ...s,
              status: "Working",
              failure: undefined,
              email: m.action.type === "request" ? m.action.email : s.email,
            },
            [request(m.action)],
          ],
    Resend: (s) =>
      s.status === "Working"
        ? s
        : [
            { ...s, status: "Working", failure: undefined },
            [request({ type: "request", email: s.email })],
          ],
    Another: (s) =>
      s.status === "Working"
        ? s
        : { ...s, phase: "email", notice: "", failure: undefined },
    Answered: (s, m) =>
      Either.isLeft(m.result)
        ? { ...s, status: "Idle", failure: m.result.left }
        : m.result.right.type === "accepted"
          ? [
              {
                ...s,
                phase: "code",
                status: "Idle",
                notice: m.result.right.message,
                failure: undefined,
              },
              [focus("input[name=code]")],
            ]
          : m.result.right.type === "session"
            ? [{ ...s, status: "Idle" }, [navigate("/app")]]
            : { ...s, status: "Idle" },
    Failed: (s, m) => ({ ...s, status: "Idle", failure: m.failure }),
  },
  view: (s, i) => {
    return html`<h1>Sign in to Gymtime</h1>
      <p>
        Use the email address your gym organizer invited. We’ll email you a
        six-digit code.
      </p>
      <p>
        Parents: use the team calendar link from your coach. You do not need to
        sign in.
      </p>
      <details>
        <summary>First time signing in?</summary>
        <p>
          Use your invited email address and the latest six-digit email code. If
          you have not been invited, ask the gym organizer. The first organizer
          uses the email configured when this instance was deployed.
        </p>
      </details>
      ${s.notice ? html`<p role="status">${s.notice}</p>` : nothing}
      <form data-intent=${i.Submit} aria-label="Email sign-in">
        ${s.phase === "email"
          ? html`<label
              >Email address<input
                name="email"
                type="email"
                autocomplete="email"
                required
                maxlength="254"
                value=${s.email}
            /></label>`
          : html`<p>Signing in as <strong>${s.email}</strong></p>
              <label
                >Sign-in code<input
                  name="code"
                  inputmode="numeric"
                  autocomplete=${"one-time-code"}
                  pattern="[0-9]{6}"
                  minlength="6"
                  maxlength="6"
                  required
                  aria-describedby="code-help"
              /></label>
              <p id="code-help">
                Codes expire after 10 minutes. You can request a new code after
                60 seconds.
              </p>`}
        ${s.failure
          ? html`<p role="alert">
              ${s.failure.message}${s.failure.issues.map(
                (issue) => html`<br />${issue.message}`,
              )}
            </p>`
          : nothing}<button ?disabled=${s.status === "Working"}>
          ${s.status === "Working"
            ? "Working…"
            : s.phase === "email"
              ? "Email me a code"
              : "Sign in"}
        </button>
      </form>
      ${s.phase === "code"
        ? html`<button
              class="secondary"
              ?disabled=${s.status === "Working"}
              data-intent=${i.Resend}
            >
              Resend code
            </button>
            <button
              class="secondary"
              ?disabled=${s.status === "Working"}
              data-intent=${i.Another}
            >
              Use another email
            </button>`
        : nothing}`;
  },
});
