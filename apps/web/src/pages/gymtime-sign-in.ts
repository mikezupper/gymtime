import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { Either } from "effect";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ApiFailure, type AuthAction } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";

@customElement("gymtime-sign-in")
export class GymtimeSignIn extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @state() private phase: "email" | "code" = "email";
  @state() private email = "";
  @state() private notice = "";
  @state() private operation: AuthAction = { type: "session" };
  private readonly action = new Task(this, {
    autoRun: false,
    args: () => [this.adapter, this.operation] as const,
    task: ([adapter, operation], { signal }) =>
      adapter
        ? adapter.auth(operation, signal).then((result) => {
            if (Either.isRight(result)) {
              if (result.right.type === "accepted") {
                this.phase = "code";
                this.notice = result.right.message;
                void this.updateComplete.then(() =>
                  this.renderRoot
                    .querySelector<HTMLInputElement>("input[name=code]")
                    ?.focus(),
                );
              } else if (result.right.type === "session") {
                window.location.assign("/app");
              }
            }
            return result;
          })
        : Promise.resolve(
            Either.left(
              new ApiFailure({
                code: "network",
                message: "The app is loading. Try again.",
                issues: [],
              }),
            ),
          ),
  });
  static override styles = css`
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
  `;
  private submit(event: SubmitEvent) {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const values = new FormData(event.currentTarget);
    if (this.phase === "email") {
      this.email = String(values.get("email") ?? "");
      this.operation = { type: "request", email: this.email };
    } else {
      this.operation = {
        type: "verify",
        email: this.email,
        code: String(values.get("code") ?? ""),
      };
    }
    void this.action.run();
  }
  private resend() {
    this.operation = { type: "request", email: this.email };
    void this.action.run();
  }
  override render() {
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
      ${this.notice ? html`<p role="status">${this.notice}</p>` : nothing}
      <form @submit=${this.submit} aria-label="Email sign-in">
        ${this.phase === "email"
          ? html`<label
              >Email address<input
                name="email"
                type="email"
                autocomplete="email"
                required
                maxlength="254"
                .value=${this.email}
            /></label>`
          : html`<p>Signing in as <strong>${this.email}</strong></p>
              <label
                >Sign-in code<input
                  name="code"
                  inputmode="numeric"
                  .autocomplete=${"one-time-code"}
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
        ${this.action.render({
          pending: () => html`<button disabled>Working…</button>`,
          complete: (result) =>
            html`${Either.isLeft(result)
                ? html`<p role="alert">
                    ${result.left.message}${result.left.issues.map(
                      (issue) => html`<br />${issue.message}`,
                    )}
                  </p>`
                : nothing}<button>
                ${this.phase === "email" ? "Email me a code" : "Sign in"}
              </button>`,
          initial: () => html`<button>Email me a code</button>`,
          error: () =>
            html`<p role="alert">
                The service could not be reached. Try again.
              </p>
              <button>Try again</button>`,
        })}
      </form>
      ${this.phase === "code"
        ? html`<button
              class="secondary"
              ?disabled=${this.action.status === TaskStatus.PENDING}
              @click=${this.resend}
            >
              Resend code
            </button>
            <button
              class="secondary"
              ?disabled=${this.action.status === TaskStatus.PENDING}
              @click=${() => {
                this.phase = "email";
                this.notice = "";
              }}
            >
              Use another email
            </button>`
        : nothing}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-sign-in": GymtimeSignIn;
  }
}
